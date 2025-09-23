// Dashboard JavaScript with Firebase Integration
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase services are available
    if (typeof auth === 'undefined' || typeof db === 'undefined') {
        console.error('Firebase services not available');
        window.location.href = 'index.html';
        return;
    }

    const logoutBtn = document.querySelector('.logout-btn');
    const usernameSpan = document.querySelector('.username');
    const postsGrid = document.querySelector('.posts-grid');
    const statsElements = document.querySelectorAll('.stat-number');

    let currentUser = null;

    // Check authentication state
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            loadUserData(user.uid);
            loadUserPosts(user.uid);
        } else {
            // User not logged in, redirect to login
            window.location.href = 'index.html';
        }
    });

    // Load user data from Firestore
    function loadUserData(userId) {
        db.collection('users').doc(userId).get()
            .then((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    // Update UI with user data
                    usernameSpan.textContent = userData.displayName || userData.nickName || userData.email;
                    
                    // Update stats if available
                    if (userData.stats) {
                        updateStats(
                            userData.stats.postsCount || 0,
                            userData.stats.publishedCount || 0,
                            userData.stats.draftsCount || 0
                        );
                    }
                } else {
                    console.log('No user document found');
                }
            })
            .catch((error) => {
                console.error('Error loading user data:', error);
            });
    }

    // Load user posts from Firestore
    function loadUserPosts(userId) {
        postsGrid.innerHTML = '<p>Loading posts...</p>';
        
        db.collection('posts')
            .where('authorId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get()
            .then((querySnapshot) => {
                postsGrid.innerHTML = '';
                
                if (querySnapshot.empty) {
                    postsGrid.innerHTML = '<p>No posts yet. <a href="editor.html">Create your first post!</a></p>';
                    return;
                }
                
                let totalPosts = 0;
                let publishedPosts = 0;
                let draftPosts = 0;
                
                querySnapshot.forEach((doc) => {
                    const post = doc.data();
                    totalPosts++;
                    
                    if (post.published) {
                        publishedPosts++;
                    } else {
                        draftPosts++;
                    }
                    
                    createPostCard(doc.id, post);
                });
                
                updateStats(totalPosts, publishedPosts, draftPosts);
            })
            .catch((error) => {
                console.error('Error loading posts:', error);
                postsGrid.innerHTML = '<p>Error loading posts. Please try again.</p>';
            });
    }

    // Create post card element
    function createPostCard(postId, post) {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.innerHTML = `
            <h3 class="post-title">${post.title || 'Untitled'}</h3>
            <p class="post-excerpt">${post.excerpt || 'No excerpt available'}</p>
            <div class="post-meta">
                <span class="post-date">${formatDate(post.createdAt)}</span>
                <span class="post-status ${post.published ? 'published' : 'draft'}">
                    ${post.published ? 'Published' : 'Draft'}
                </span>
            </div>
            <div class="post-actions">
                <button class="btn-edit" data-id="${postId}">Edit</button>
                <button class="btn-delete" data-id="${postId}">Delete</button>
            </div>
        `;
        
        postsGrid.appendChild(postCard);
        
        // Add event listeners
        postCard.querySelector('.btn-edit').addEventListener('click', function() {
            window.location.href = `editor.html?postId=${postId}`;
        });
        
        postCard.querySelector('.btn-delete').addEventListener('click', function() {
            deletePost(postId);
        });
    }

    // Update stats display
    function updateStats(total, published, draft) {
        if (statsElements.length >= 3) {
            statsElements[0].textContent = total;
            statsElements[1].textContent = published;
            statsElements[2].textContent = draft;
        }
    }

    // Format date
    function formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        try {
            const date = timestamp.toDate();
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    }

    // Logout functionality
    logoutBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to logout?')) {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        }
    });

    // Delete post function
    function deletePost(postId) {
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            db.collection('posts').doc(postId).delete()
                .then(() => {
                    // Reload posts
                    loadUserPosts(currentUser.uid);
                })
                .catch((error) => {
                    alert('Error deleting post: ' + error.message);
                });
        }
    }
});