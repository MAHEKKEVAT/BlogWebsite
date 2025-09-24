// View Posts JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializePostsPage();
});

async function initializePostsPage() {
    try {
        await checkFirebaseConnection();
        setupEventListeners();
        loadPosts();
    } catch (error) {
        console.error('Posts page initialization failed:', error);
        showError('Failed to load posts');
    }
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterPosts);
    }

    // Sort functionality
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', sortPosts);
    }

    // Logout functionality
    document.querySelector('.logout-btn').addEventListener('click', () => {
        showLogoutModal();
    });
}

async function loadPosts() {
    const user = window.firebaseAuth.currentUser;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    showLoading(true);

    try {
        const postsSnapshot = await window.firebaseDb.collection('users').doc(user.uid)
            .collection('published')
            .orderBy('publishedAt', 'desc')
            .get();

        displayPosts(postsSnapshot);
        updateStats(postsSnapshot);
        
    } catch (error) {
        console.error('Error loading posts:', error);
        showError('Failed to load posts');
    } finally {
        showLoading(false);
    }
}

function displayPosts(postsSnapshot) {
    const container = document.getElementById('posts-container');
    
    if (postsSnapshot.empty) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-newspaper"></i>
                </div>
                <h3>No published posts yet</h3>
                <p>Publish your first post to see it appear here</p>
                <a href="editor.html" class="btn-primary">
                    <i class="fas fa-plus"></i>
                    Create First Post
                </a>
            </div>
        `;
        return;
    }

    const postsHTML = postsSnapshot.docs.map((doc, index) => {
        const post = doc.data();
        const isFeatured = index === 0; // First post is featured
        return createPostCard(doc.id, post, isFeatured);
    }).join('');

    container.innerHTML = postsHTML;
}

function createPostCard(postId, post, isFeatured = false) {
    const wordCount = post.content ? post.content.split(/\s+/).length : 0;
    const readTime = Math.ceil(wordCount / 200);
    const publishDate = post.publishedAt ? post.publishedAt.toDate() : new Date();
    
    return `
        <div class="post-card ${isFeatured ? 'featured' : ''}" data-title="${post.title?.toLowerCase() || ''}">
            <div class="post-header">
                <h3 class="post-title">${post.title || 'Untitled Post'}</h3>
                <span class="post-badge">PUBLISHED</span>
            </div>
            
            <p class="post-excerpt">${post.excerpt || 'No excerpt available...'}</p>
            
            <div class="post-stats">
                <div class="stat-group">
                    <span class="stat">
                        <i class="fas fa-clock"></i> ${readTime} min read
                    </span>
                    <span class="stat">
                        <i class="fas fa-file-word"></i> ${wordCount} words
                    </span>
                </div>
                <span class="post-date">${formatDate(publishDate)}</span>
            </div>
            
            <div class="post-actions">
                <button class="post-btn btn-edit" onclick="editPost('${postId}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="post-btn btn-view" onclick="viewPost('${postId}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="post-btn btn-delete" onclick="deletePost('${postId}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

function updateStats(postsSnapshot) {
    const totalPosts = postsSnapshot.size;
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const monthPosts = postsSnapshot.docs.filter(doc => {
        const publishedAt = doc.data().publishedAt;
        return publishedAt && publishedAt.toDate() > monthAgo;
    }).length;

    document.getElementById('totalPosts').textContent = totalPosts;
    document.getElementById('monthPosts').textContent = monthPosts;
    document.getElementById('totalViews').textContent = '0'; // Placeholder for views
}

function filterPosts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const posts = document.querySelectorAll('.post-card');
    
    posts.forEach(post => {
        const title = post.dataset.title;
        const shouldShow = title.includes(searchTerm);
        post.style.display = shouldShow ? 'block' : 'none';
    });
}

function sortPosts() {
    const sortValue = document.getElementById('sortSelect').value;
    // Implementation for sorting logic
    console.log('Sort by:', sortValue);
}

function editPost(postId) {
    window.location.href = `editor.html?edit=${postId}`;
}

function viewPost(postId) {
    // Placeholder for view post functionality
    alert('View post functionality would be implemented here');
}

async function deletePost(postId) {
    if (!confirm('Delete this published post permanently?')) return;

    try {
        const user = window.firebaseAuth.currentUser;
        await window.firebaseDb.collection('users').doc(user.uid)
            .collection('published').doc(postId).delete();
            
        showSuccess('Post deleted successfully!');
        loadPosts();
    } catch (error) {
        console.error('Error deleting post:', error);
        showError('Failed to delete post');
    }
}

// Utility functions (same as drafts)
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(show) {
    const loadingState = document.getElementById('loading-state');
    const container = document.getElementById('posts-container');
    
    if (loadingState) loadingState.style.display = show ? 'block' : 'none';
    if (container) container.style.display = show ? 'none' : 'grid';
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-success';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function checkFirebaseConnection() {
    return new Promise((resolve) => {
        const statusElement = document.getElementById('firebaseStatus');
        
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Firebase Connected';
                statusElement.className = 'status-indicator connected';
                resolve(user);
            } else {
                window.location.href = 'index.html';
            }
        });
    });
}

function showLogoutModal() {
    if (confirm('Are you sure you want to logout?')) {
        window.firebaseAuth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}