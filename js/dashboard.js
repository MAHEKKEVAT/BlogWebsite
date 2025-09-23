// Dashboard JavaScript with Firebase Integration
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase services are available
    if (!window.firebaseAuth || !window.firebaseDb) {
        console.error('Firebase services not available');
        redirectToLogin();
        return;
    }

    // DOM Elements
    const logoutBtn = document.querySelector('.logout-btn');
    const usernameSpan = document.querySelector('.username');
    const postsContainer = document.getElementById('posts-container');
    const loadingState = document.getElementById('loading-state');
    const statNumbers = document.querySelectorAll('.stat-number');
    const viewBtns = document.querySelectorAll('.view-btn');
    const logoutModal = document.getElementById('logout-modal');
    const cancelBtn = document.querySelector('.btn-cancel');
    const confirmLogoutBtn = document.querySelector('.btn-confirm-logout');

    let currentUser = null;
    let allPosts = [];
    let currentFilter = 'all';

    // Check authentication state
    window.firebaseAuth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            console.log('User authenticated:', user.email);
            loadUserData(user.uid);
            loadUserPosts(user.uid);
            setupNavigationProtection();
        } else {
            console.log('No user authenticated, redirecting to login');
            redirectToLogin();
        }
    });

    // Load user data from Firestore
    function loadUserData(userId) {
        window.firebaseDb.collection('users').doc(userId).get()
            .then((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    // Update UI with user data
                    const displayName = userData.nickName || userData.displayName || userData.email.split('@')[0];
                    usernameSpan.textContent = displayName;
                    usernameSpan.title = userData.email;
                    
                    console.log('User data loaded:', userData);
                } else {
                    console.log('No user document found, creating one...');
                    createUserDocument(userId);
                }
            })
            .catch((error) => {
                console.error('Error loading user data:', error);
                showError('Failed to load user data');
            });
    }

    // Create user document if it doesn't exist
    function createUserDocument(userId) {
        const userData = {
            uid: userId,
            email: currentUser.email,
            displayName: currentUser.email.split('@')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            profileComplete: false,
            role: 'user',
            status: 'active'
        };
        
        window.firebaseDb.collection('users').doc(userId).set(userData)
            .then(() => {
                console.log('User document created');
                loadUserData(userId);
            })
            .catch((error) => {
                console.error('Error creating user document:', error);
            });
    }

    // Load user posts from Firestore
    function loadUserPosts(userId) {
        showLoading();
        
        // Load published posts
        const publishedPromise = window.firebaseDb.collection('users').doc(userId)
            .collection('published')
            .orderBy('publishedAt', 'desc')
            .get();
            
        // Load draft posts
        const draftsPromise = window.firebaseDb.collection('users').doc(userId)
            .collection('drafts')
            .orderBy('updatedAt', 'desc')
            .get();
            
        Promise.all([publishedPromise, draftsPromise])
            .then(([publishedSnapshot, draftsSnapshot]) => {
                allPosts = [];
                let totalPosts = 0;
                let publishedPosts = 0;
                let draftPosts = 0;
                
                // Process published posts
                publishedSnapshot.forEach((doc) => {
                    const post = {
                        id: doc.id,
                        ...doc.data(),
                        published: true
                    };
                    allPosts.push(post);
                    totalPosts++;
                    publishedPosts++;
                });
                
                // Process draft posts
                draftsSnapshot.forEach((doc) => {
                    const post = {
                        id: doc.id,
                        ...doc.data(),
                        published: false
                    };
                    allPosts.push(post);
                    totalPosts++;
                    draftPosts++;
                });
                
                // Sort all posts by date (newest first)
                allPosts.sort((a, b) => {
                    const dateA = a.publishedAt || a.updatedAt || a.createdAt;
                    const dateB = b.publishedAt || b.updatedAt || b.createdAt;
                    return dateB - dateA;
                });
                
                updateStats(totalPosts, publishedPosts, draftPosts);
                displayPosts(allPosts);
                hideLoading();
            })
            .catch((error) => {
                console.error('Error loading posts:', error);
                hideLoading();
                showError('Failed to load posts. Please try again.');
            });
    }

    // Display posts based on current filter
    function displayPosts(posts) {
        const filteredPosts = posts.filter(post => {
            if (currentFilter === 'published') return post.published;
            if (currentFilter === 'drafts') return !post.published;
            return true; // 'all'
        });
        
        if (filteredPosts.length === 0) {
            showEmptyState();
            return;
        }
        
        postsContainer.innerHTML = '';
        
        filteredPosts.forEach(post => {
            const postCard = createPostCard(post);
            postsContainer.appendChild(postCard);
        });
    }

    // Create post card element
    function createPostCard(post) {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.innerHTML = `
            <h3 class="post-title">${escapeHtml(post.title || 'Untitled Post')}</h3>
            <p class="post-excerpt">${escapeHtml(post.excerpt || 'No excerpt available')}</p>
            <div class="post-meta">
                <span class="post-date">${formatDate(post.publishedAt || post.updatedAt || post.createdAt)}</span>
                <span class="post-status ${post.published ? 'published' : 'draft'}">
                    ${post.published ? 'Published' : 'Draft'}
                </span>
                <span class="post-read-time">${post.readTime || 1} min read</span>
            </div>
            <div class="post-actions">
                <button class="btn-edit" data-id="${post.id}">Edit</button>
                <button class="btn-delete" data-id="${post.id}">Delete</button>
                ${post.published ? 
                    '<button class="btn-view" data-id="${post.id}">View</button>' : 
                    '<button class="btn-publish" data-id="${post.id}">Publish</button>'
                }
            </div>
        `;
        
        // Add event listeners
        const editBtn = postCard.querySelector('.btn-edit');
        const deleteBtn = postCard.querySelector('.btn-delete');
        const actionBtn = postCard.querySelector(post.published ? '.btn-view' : '.btn-publish');
        
        editBtn.addEventListener('click', () => editPost(post.id, post.published));
        deleteBtn.addEventListener('click', () => deletePost(post.id, post.published));
        actionBtn.addEventListener('click', () => post.published ? viewPost(post.id) : publishPost(post.id));
        
        return postCard;
    }

    // Update stats display
    function updateStats(total, published, draft) {
        if (statNumbers.length >= 3) {
            statNumbers[0].textContent = total;
            statNumbers[1].textContent = published;
            statNumbers[2].textContent = draft;
        }
    }

    // Post actions
    function editPost(postId, isPublished) {
        window.location.href = `editor.html?edit=${postId}`;
    }

    function viewPost(postId) {
        window.location.href = `post.html?id=${postId}`;
    }

    function publishPost(postId) {
        if (confirm('Publish this post?')) {
            // Get the draft first
            window.firebaseDb.collection('users').doc(currentUser.uid)
                .collection('drafts').doc(postId).get()
                .then((doc) => {
                    if (doc.exists) {
                        const postData = doc.data();
                        const batch = window.firebaseDb.batch();
                        
                        // Add to published
                        const publishedRef = window.firebaseDb.collection('users').doc(currentUser.uid)
                            .collection('published').doc(postId);
                        batch.set(publishedRef, {
                            ...postData,
                            published: true,
                            publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // Remove from drafts
                        const draftRef = window.firebaseDb.collection('users').doc(currentUser.uid)
                            .collection('drafts').doc(postId);
                        batch.delete(draftRef);
                        
                        return batch.commit();
                    }
                })
                .then(() => {
                    showSuccess('Post published successfully!');
                    loadUserPosts(currentUser.uid);
                })
                .catch((error) => {
                    console.error('Error publishing post:', error);
                    showError('Failed to publish post');
                });
        }
    }

    function deletePost(postId, isPublished) {
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            const collection = isPublished ? 'published' : 'drafts';
            window.firebaseDb.collection('users').doc(currentUser.uid)
                .collection(collection).doc(postId).delete()
                .then(() => {
                    showSuccess('Post deleted successfully!');
                    loadUserPosts(currentUser.uid);
                })
                .catch((error) => {
                    console.error('Error deleting post:', error);
                    showError('Failed to delete post');
                });
        }
    }

    // View filter functionality
    viewBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            viewBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            displayPosts(allPosts);
        });
    });

    // Logout functionality
    logoutBtn.addEventListener('click', function() {
        logoutModal.style.display = 'block';
    });

    cancelBtn.addEventListener('click', function() {
        logoutModal.style.display = 'none';
    });

    confirmLogoutBtn.addEventListener('click', function() {
        window.firebaseAuth.signOut().then(() => {
            console.log('User signed out');
            localStorage.setItem('logout', Date.now());
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Logout error:', error);
            showError('Logout failed. Please try again.');
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === logoutModal) {
            logoutModal.style.display = 'none';
        }
    });

    // Navigation protection
    function setupNavigationProtection() {
        window.addEventListener('beforeunload', function(e) {
            if (!localStorage.getItem('logout')) {
                const message = 'You have unsaved changes. Are you sure you want to leave?';
                e.returnValue = message;
                return message;
            }
        });
    }

    // Utility functions
    function formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        try {
            const date = timestamp.toDate();
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading() {
        loadingState.style.display = 'block';
        postsContainer.style.display = 'none';
    }

    function hideLoading() {
        loadingState.style.display = 'none';
        postsContainer.style.display = 'grid';
    }

    function showEmptyState() {
        postsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No ${currentFilter === 'all' ? 'posts' : currentFilter} yet</h3>
                <p>Start your writing journey by creating your first blog post</p>
                <a href="editor.html" class="btn-primary">Create Your First Post</a>
            </div>
        `;
    }

    function showSuccess(message) {
        // Create and show success message
        const messageEl = document.createElement('div');
        messageEl.className = 'message message-success';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(messageEl);
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    function showError(message) {
        // Create and show error message
        const messageEl = document.createElement('div');
        messageEl.className = 'message message-error';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(messageEl);
        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }

    function redirectToLogin() {
        window.location.href = 'index.html';
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'n':
                    e.preventDefault();
                    window.location.href = 'editor.html';
                    break;
                case 'l':
                    e.preventDefault();
                    logoutModal.style.display = 'block';
                    break;
            }
        }
    });

    console.log('Dashboard initialized successfully');
});