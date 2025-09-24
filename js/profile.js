// profile.js - Fixed to fetch from correct user document
let currentUser, userProfile = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeProfile();
});

function initializeProfile() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            db = firebase.firestore();
            console.log('👤 Current User UID:', currentUser.uid);
            setupEventListeners();
            loadUserProfile();
        } else {
            window.location.href = 'index.html';
        }
    });
}

function setupEventListeners() {
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('avatarUpload').addEventListener('change', uploadAvatar);
}

async function loadUserProfile() {
    showLoading(true);
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            userProfile = userDoc.data();
            console.log('✅ User profile loaded:', userProfile);
            displayUserProfile();
            await loadUserStats();
        } else {
            console.log('📝 Creating new user profile...');
            userProfile = createDefaultProfile();
            await saveProfileToFirestore();
            displayUserProfile();
            await loadUserStats();
        }
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        showStatus('Error loading profile', 'error');
    } finally {
        showLoading(false);
    }
}

function createDefaultProfile() {
    return {
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        email: currentUser.email,
        fullName: '',
        bio: '',
        city: '',
        role: 'user',
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function displayUserProfile() {
    if (!userProfile) return;
    
    document.getElementById('userName').textContent = userProfile.displayName || 'User';
    document.getElementById('userEmail').textContent = userProfile.email;
    document.getElementById('userBio').textContent = userProfile.bio || 'No bio yet';
    document.getElementById('userCity').textContent = userProfile.city || 'Not specified';
    document.getElementById('userRole').textContent = userProfile.role || 'user';
    
    if (userProfile.createdAt) {
        const memberSince = userProfile.createdAt.toDate();
        document.getElementById('memberSince').textContent = memberSince.toLocaleDateString();
    }
    
    document.getElementById('displayName').value = userProfile.displayName || '';
    document.getElementById('fullName').value = userProfile.fullName || '';
    document.getElementById('bio').value = userProfile.bio || '';
    document.getElementById('city').value = userProfile.city || '';
    
    if (userProfile.avatarUrl) {
        document.getElementById('avatarImage').src = userProfile.avatarUrl;
        document.getElementById('avatarImage').style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';
    } else {
        const initials = (userProfile.displayName || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('avatarInitials').textContent = initials.substring(0, 2);
    }
}

async function loadUserStats() {
    if (!currentUser) return;
    
    try {
        console.log('📊 Loading posts for user:', currentUser.uid);
        
        // Try to fetch from the current user's collections
        const [draftsSnapshot, publishedSnapshot] = await Promise.all([
            db.collection('users').doc(currentUser.uid).collection('drafts').get(),
            db.collection('users').doc(currentUser.uid).collection('published').get()
        ]);
        
        const draftsCount = draftsSnapshot.size;
        const publishedCount = publishedSnapshot.size;
        const totalPosts = draftsCount + publishedCount;
        
        console.log('📈 Posts found:', {
            drafts: draftsCount,
            published: publishedCount,
            total: totalPosts
        });
        
        // Update the UI
        updateStatsUI(totalPosts, publishedCount, draftsCount);
        
        // If no posts found, try alternative user IDs
        if (totalPosts === 0) {
            console.log('🔍 No posts found, checking for alternative user IDs...');
            await checkAlternativeUserIds();
        } else {
            await loadUserPosts();
        }
        
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        showStatus('Error loading posts data', 'error');
    }
}

async function checkAlternativeUserIds() {
    try {
        // Get all users to find the correct one
        const usersSnapshot = await db.collection('users').get();
        let correctUserId = null;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.email === currentUser.email) {
                correctUserId = doc.id;
                console.log('✅ Found matching user by email:', correctUserId);
            }
        });
        
        if (correctUserId && correctUserId !== currentUser.uid) {
            console.log('🔄 Switching to correct user ID:', correctUserId);
            await loadPostsFromUserId(correctUserId);
        } else {
            console.log('📭 No posts found for any user ID');
            updateStatsUI(0, 0, 0);
            showNoPostsMessage();
        }
        
    } catch (error) {
        console.error('Error checking alternative user IDs:', error);
        updateStatsUI(0, 0, 0);
        showNoPostsMessage();
    }
}

async function loadPostsFromUserId(userId) {
    try {
        console.log('📖 Loading posts from user ID:', userId);
        
        const [draftsSnapshot, publishedSnapshot] = await Promise.all([
            db.collection('users').doc(userId).collection('drafts').get(),
            db.collection('users').doc(userId).collection('published').get()
        ]);
        
        const draftsCount = draftsSnapshot.size;
        const publishedCount = publishedSnapshot.size;
        const totalPosts = draftsCount + publishedCount;
        
        console.log('📊 Posts found for user', userId, ':', {
            drafts: draftsCount,
            published: publishedCount,
            total: totalPosts
        });
        
        updateStatsUI(totalPosts, publishedCount, draftsCount);
        
        if (totalPosts > 0) {
            await loadPostsFromSpecificUser(userId);
        } else {
            showNoPostsMessage();
        }
        
    } catch (error) {
        console.error('Error loading posts from user ID:', error);
        updateStatsUI(0, 0, 0);
        showNoPostsMessage();
    }
}

function updateStatsUI(totalPosts, publishedCount, draftsCount) {
    // Update sidebar stats
    document.getElementById('totalPosts').textContent = totalPosts;
    document.getElementById('publishedCount').textContent = publishedCount;
    document.getElementById('draftsCount').textContent = draftsCount;
    
    // Update dashboard cards
    document.getElementById('totalPostsCard').textContent = totalPosts;
    document.getElementById('publishedPostsCard').textContent = publishedCount;
    document.getElementById('draftPostsCard').textContent = draftsCount;
    
    // Calculate account age
    if (userProfile && userProfile.createdAt) {
        const created = userProfile.createdAt.toDate();
        const diffDays = Math.ceil((new Date() - created) / (1000 * 60 * 60 * 24));
        document.getElementById('accountAge').textContent = diffDays;
    }
}

async function loadUserPosts() {
    await loadPostsFromSpecificUser(currentUser.uid);
}

async function loadPostsFromSpecificUser(userId) {
    try {
        console.log('📝 Loading posts for user:', userId);
        
        const [draftsSnapshot, publishedSnapshot] = await Promise.all([
            db.collection('users').doc(userId).collection('drafts')
                .orderBy('createdAt', 'desc')
                .get(),
            db.collection('users').doc(userId).collection('published')
                .orderBy('publishedAt', 'desc')
                .get()
        ]);
        
        const postsList = document.getElementById('postsList');
        const recentActivity = document.getElementById('recentActivity');
        
        postsList.innerHTML = '';
        recentActivity.innerHTML = '';
        
        // Combine all posts
        const allPosts = [];
        
        draftsSnapshot.forEach(doc => {
            const postData = doc.data();
            allPosts.push({
                id: doc.id,
                ...postData,
                type: 'draft',
                collection: 'drafts',
                date: postData.createdAt || postData.updatedAt,
                userId: userId
            });
        });
        
        publishedSnapshot.forEach(doc => {
            const postData = doc.data();
            allPosts.push({
                id: doc.id,
                ...postData,
                type: 'published',
                collection: 'published',
                date: postData.publishedAt || postData.createdAt,
                userId: userId
            });
        });
        
        // Sort by date (newest first)
        allPosts.sort((a, b) => {
            const dateA = a.date ? a.date.toDate() : new Date(0);
            const dateB = b.date ? b.date.toDate() : new Date(0);
            return dateB - dateA;
        });
        
        console.log('📄 Total posts to display:', allPosts.length);
        
        if (allPosts.length === 0) {
            showNoPostsMessage();
            return;
        }
        
        // Display all posts in My Posts tab
        allPosts.forEach(post => {
            postsList.appendChild(createPostElement(post));
        });
        
        // Display recent activity (latest 3 posts)
        const recentPosts = allPosts.slice(0, 3);
        recentPosts.forEach(post => {
            recentActivity.appendChild(createActivityElement(post));
        });
        
    } catch (error) {
        console.error('❌ Error loading posts:', error);
        showNoPostsMessage();
    }
}

function showNoPostsMessage() {
    const postsList = document.getElementById('postsList');
    const recentActivity = document.getElementById('recentActivity');
    
    postsList.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #6b7280;">
            <i class="fas fa-newspaper" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <h3>No posts yet</h3>
            <p>Start writing your first post!</p>
            <button class="btn btn-primary" onclick="window.location.href='editor.html'">
                <i class="fas fa-plus"></i>
                Create New Post
            </button>
        </div>
    `;
    
    recentActivity.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-info-circle"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">No recent activity</div>
                <div class="activity-time">Start writing to see your activity here</div>
            </div>
        </div>
    `;
}

function createPostElement(post) {
    const div = document.createElement('div');
    const postDate = post.date ? post.date.toDate().toLocaleDateString() : 'Unknown date';
    const contentPreview = post.content ? 
        (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content) : 
        'No content';
    
    div.className = `post-card ${post.type}`;
    div.innerHTML = `
        <div class="post-header">
            <h3 class="post-title">${post.title || 'Untitled Post'}</h3>
            <span class="post-status ${post.type}">${post.type.charAt(0).toUpperCase() + post.type.slice(1)}</span>
        </div>
        <div class="post-content">${contentPreview}</div>
        <div class="post-meta">
            <span>${post.type === 'published' ? 'Published' : 'Created'}: ${postDate}</span>
            <div class="post-actions">
                <button class="action-btn edit" onclick="editPost('${post.id}', '${post.collection}', '${post.userId}')">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
                <button class="action-btn delete" onclick="deletePost('${post.id}', '${post.collection}', '${post.userId}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `;
    
    return div;
}

function createActivityElement(post) {
    const div = document.createElement('div');
    const activityType = post.type === 'published' ? 'published a post' : 'saved a draft';
    const postDate = post.date ? post.date.toDate() : new Date();
    const icon = post.type === 'published' ? 'fa-globe' : 'fa-edit';
    
    div.className = 'activity-item';
    div.innerHTML = `
        <div class="activity-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-title">You ${activityType}: "${post.title || 'Untitled'}"</div>
            <div class="activity-time">${formatRelativeTime(postDate)}</div>
        </div>
    `;
    
    return div;
}

async function saveProfile(e) {
    e.preventDefault();
    showLoading(true);
    
    try {
        const updatedProfile = {
            displayName: document.getElementById('displayName').value.trim(),
            fullName: document.getElementById('fullName').value.trim(),
            bio: document.getElementById('bio').value.trim(),
            city: document.getElementById('city').value.trim(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: new Date().toISOString()
        };
        
        await db.collection('users').doc(currentUser.uid).update(updatedProfile);
        userProfile = { ...userProfile, ...updatedProfile };
        displayUserProfile();
        showStatus('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Error saving profile:', error);
        showStatus('Error updating profile', 'error');
    } finally {
        showLoading(false);
    }
}

function saveProfileToFirestore() {
    return db.collection('users').doc(currentUser.uid).set(userProfile, { merge: true });
}

function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
        showStatus('Please select a valid image file (<5MB)', 'error');
        return;
    }
    
    showLoading(true);
    const storageRef = firebase.storage().ref();
    const avatarRef = storageRef.child(`avatars/${currentUser.uid}/${file.name}`);
    
    avatarRef.put(file)
        .then(snapshot => snapshot.ref.getDownloadURL())
        .then(downloadURL => db.collection('users').doc(currentUser.uid).update({
            avatarUrl: downloadURL,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }))
        .then(() => {
            userProfile.avatarUrl = downloadURL;
            displayUserProfile();
            showStatus('Avatar updated successfully!', 'success');
        })
        .catch(error => {
            console.error('Error uploading avatar:', error);
            showStatus('Error uploading avatar', 'error');
        })
        .finally(() => showLoading(false));
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.currentTarget.classList.add('active');
}

function filterPosts(type) {
    const posts = document.querySelectorAll('.post-card');
    posts.forEach(post => {
        if (type === 'all') {
            post.style.display = 'block';
        } else if (type === 'published') {
            post.style.display = post.classList.contains('published') ? 'block' : 'none';
        } else if (type === 'drafts') {
            post.style.display = post.classList.contains('draft') ? 'block' : 'none';
        }
    });
}

function editPost(postId, collection, userId = null) {
    const targetUserId = userId || currentUser.uid;
    window.location.href = `editor.html?postId=${postId}&collection=${collection}&userId=${targetUserId}`;
}

async function deletePost(postId, collection, userId = null) {
    if (confirm('Are you sure you want to delete this post?')) {
        try {
            const targetUserId = userId || currentUser.uid;
            await db.collection('users').doc(targetUserId).collection(collection).doc(postId).delete();
            showStatus('Post deleted successfully', 'success');
            // Reload posts and stats
            await loadUserStats();
        } catch (error) {
            console.error('Error deleting post:', error);
            showStatus('Error deleting post', 'error');
        }
    }
}

function resetForm() {
    displayUserProfile();
    showStatus('Form reset to current values', 'warning');
}

function formatRelativeTime(date) {
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showStatus(message, type) {
    const el = document.getElementById('statusMessage');
    el.textContent = message;
    el.className = `status-message status-${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
}

// Global functions
window.switchTab = switchTab;
window.filterPosts = filterPosts;
window.editPost = editPost;
window.deletePost = deletePost;
window.resetForm = resetForm;