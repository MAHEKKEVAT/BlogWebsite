// Dashboard JavaScript - Updated with Quick Actions
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        await checkFirebaseConnection();
        setupEventListeners();
        loadDashboardData();
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showError('Failed to load dashboard. Please refresh the page.');
    }
}

function setupEventListeners() {
    // View filter buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterPosts(this.dataset.filter);
        });
    });

    // Logout functionality
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', showLogoutModal);
    }
}

async function loadDashboardData() {
    const user = window.firebaseAuth.currentUser;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    showLoading(true);

    try {
        // Update username
        const userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.querySelector('.username').textContent = 
                userData.displayName || userData.email.split('@')[0];
        }

        // Load both drafts and published posts
        const [draftsSnapshot, publishedSnapshot] = await Promise.all([
            window.firebaseDb.collection('users')
                .doc(user.uid)
                .collection('drafts')
                .orderBy('updatedAt', 'desc')
                .limit(10)
                .get(),
            window.firebaseDb.collection('users')
                .doc(user.uid)
                .collection('published')
                .orderBy('publishedAt', 'desc')
                .limit(10)
                .get()
        ]);

        const allPosts = [
            ...publishedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                published: true,
                type: 'published'
            })),
            ...draftsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                published: false,
                type: 'draft'
            }))
        ].sort((a, b) => {
            const dateA = a.publishedAt || a.updatedAt;
            const dateB = b.publishedAt || b.updatedAt;
            return new Date(dateB) - new Date(dateA);
        });

        displayPosts(allPosts.slice(0, 6)); // Show latest 6 posts
        updateStats(publishedSnapshot.size, draftsSnapshot.size);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    } finally {
        showLoading(false);
    }
}

function displayPosts(posts) {
    const container = document.getElementById('posts-container');
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3>No posts yet</h3>
                <p>Start your writing journey by creating your first blog post</p>
                <a href="editor.html" class="btn-primary">
                    <i class="fas fa-plus"></i>
                    Create Your First Post
                </a>
            </div>
        `;
        return;
    }

    const postsHTML = posts.map(post => createPostCard(post)).join('');
    container.innerHTML = postsHTML;
}

function createPostCard(post) {
    const wordCount = post.content ? post.content.split(/\s+/).length : 0;
    const readTime = Math.ceil(wordCount / 200);
    const date = post.published ? 
        (post.publishedAt ? formatDate(post.publishedAt.toDate()) : 'Unknown') :
        (post.updatedAt ? formatDate(post.updatedAt.toDate()) : 'Unknown');

    return `
        <div class="post-card" data-type="${post.type}">
            <h3 class="post-title">${post.title || 'Untitled Post'}</h3>
            <p class="post-excerpt">${post.excerpt || 'No content available...'}</p>
            <div class="post-meta">
                <span class="post-date">${date}</span>
                <span class="post-status ${post.published ? 'published' : 'draft'}">
                    ${post.published ? 'Published' : 'Draft'}
                </span>
                <span class="post-read-time">${readTime} min read</span>
            </div>
            <div class="post-actions">
                <button class="btn-edit" onclick="editPost('${post.id}', ${post.published})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete" onclick="deletePost('${post.id}', ${post.published})">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ${post.published ? 
                    `<button class="btn-view" onclick="viewPost('${post.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>` :
                    `<button class="btn-publish" onclick="publishPost('${post.id}')">
                        <i class="fas fa-paper-plane"></i> Publish
                    </button>`
                }
            </div>
        </div>
    `;
}

function filterPosts(filter) {
    const posts = document.querySelectorAll('.post-card');
    posts.forEach(post => {
        const shouldShow = filter === 'all' || post.dataset.type === filter;
        post.style.display = shouldShow ? 'block' : 'none';
    });

    // Show empty state if no posts match filter
    const visiblePosts = document.querySelectorAll('.post-card[style=""]');
    const emptyState = document.querySelector('.empty-state');
    if (visiblePosts.length === 0 && emptyState) {
        emptyState.style.display = 'block';
    }
}

function updateStats(publishedCount, draftsCount) {
    const total = publishedCount + draftsCount;
    
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length >= 3) {
        statNumbers[0].textContent = total;
        statNumbers[1].textContent = publishedCount;
        statNumbers[2].textContent = draftsCount;
    }
}

// Global functions for quick actions
window.showDrafts = () => {
    window.location.href = 'view-drafts.html';
};

window.showPublished = () => {
    window.location.href = 'view-posts.html';
};

window.editPost = (id, isPublished) => {
    window.location.href = `editor.html?edit=${id}`;
};

window.deletePost = (id, isPublished) => {
    if (confirm('Delete this post?')) {
        const collection = isPublished ? 'published' : 'drafts';
        window.firebaseDb.collection('users').doc(window.firebaseAuth.currentUser.uid)
            .collection(collection).doc(id).delete()
            .then(() => loadDashboardData())
            .catch(error => showError('Failed to delete post'));
    }
};

window.publishPost = (id) => {
    if (confirm('Publish this draft?')) {
        const user = window.firebaseAuth.currentUser;
        if (!user) return;

        // Get draft and move to published
        window.firebaseDb.collection('users').doc(user.uid)
            .collection('drafts').doc(id).get()
            .then(doc => {
                if (doc.exists) {
                    const batch = window.firebaseDb.batch();
                    const publishedRef = window.firebaseDb.collection('users').doc(user.uid)
                        .collection('published').doc(id);
                    const draftRef = window.firebaseDb.collection('users').doc(user.uid)
                        .collection('drafts').doc(id);

                    batch.set(publishedRef, {
                        ...doc.data(),
                        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'published'
                    });
                    batch.delete(draftRef);
                    
                    return batch.commit();
                }
            })
            .then(() => {
                showSuccess('Draft published successfully!');
                loadDashboardData();
            })
            .catch(error => showError('Failed to publish draft'));
    }
};

window.viewPost = (id) => {
    showSuccess('Post view functionality would open the published post');
};

// Utility functions
function checkFirebaseConnection() {
    return new Promise((resolve) => {
        const statusElement = document.getElementById('firebaseStatus');
        
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                updateFirebaseStatus('connected');
                resolve(user);
            } else {
                window.location.href = 'index.html';
            }
        });

        setTimeout(() => {
            if (window.firebaseAuth && window.firebaseDb) {
                updateFirebaseStatus('connected');
                resolve();
            }
        }, 2000);
    });
}

function updateFirebaseStatus(status) {
    const element = document.getElementById('firebaseStatus');
    element.className = `status-indicator ${status}`;
    
    switch(status) {
        case 'connected':
            element.innerHTML = '<i class="fas fa-check-circle"></i> Firebase Connected';
            break;
        case 'error':
            element.innerHTML = '<i class="fas fa-exclamation-circle"></i> Firebase Error';
            break;
        default:
            element.innerHTML = '<i class="fas fa-circle"></i> Firebase Connecting...';
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(show) {
    const loadingState = document.getElementById('loading-state');
    const postsContainer = document.getElementById('posts-container');
    
    if (loadingState) loadingState.style.display = show ? 'block' : 'none';
    if (postsContainer) postsContainer.style.display = show ? 'none' : 'grid';
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: ${type === 'success' ? '#d1fae5' : '#fee2e2'};
        color: ${type === 'success' ? '#065f46' : '#991b1b'};
        border: 1px solid ${type === 'success' ? '#a7f3d0' : '#fecaca'};
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showLogoutModal() {
    if (confirm('Are you sure you want to logout?')) {
        window.firebaseAuth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}