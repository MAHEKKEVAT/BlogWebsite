// profile.js - Fixed version

// Firebase variables (remove 'let' if already declared elsewhere)
let currentUser;
let userProfile = null;

// Initialize profile page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Profile page loaded');
    initializeFirebase();
});

function initializeFirebase() {
    console.log('📡 Initializing Firebase...');
    
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        console.error('❌ Firebase not initialized');
        return;
    }
    
    // Set up auth state listener
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('✅ User authenticated:', user.email);
            currentUser = user;
            db = firebase.firestore();
            storage = firebase.storage();
            setupEventListeners();
            loadUserProfile();
        } else {
            console.log('❌ No user authenticated, redirecting to login...');
            window.location.href = 'index.html';
        }
    });
}

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Profile form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }
    
    // Avatar upload
    const avatarUpload = document.getElementById('avatarUpload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', uploadAvatar);
    }
    
    console.log('✅ Event listeners setup complete');
}

async function loadUserProfile() {
    console.log('👤 Loading user profile...');
    showLoading(true);
    
    try {
        if (!currentUser || !db) {
            throw new Error('Firebase not properly initialized');
        }
        
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
        showStatus('Error loading profile: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function createDefaultProfile() {
    console.log('🆕 Creating default profile...');
    return {
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        email: currentUser.email,
        fullName: '',
        nickName: '',
        city: '',
        bio: '',
        emailVerified: currentUser.emailVerified || false,
        profileComplete: false,
        role: 'user',
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        lastActive: new Date().toISOString(),
        stats: {
            draftsCount: 0,
            postsCount: 0,
            publishedCount: 0
        }
    };
}

function displayUserProfile() {
    if (!userProfile) {
        console.error('❌ No user profile to display');
        return;
    }
    
    console.log('🎨 Displaying user profile...');
    
    // Basic info
    document.getElementById('userName').textContent = userProfile.displayName || 'User';
    document.getElementById('userEmail').textContent = userProfile.email || 'No email';
    document.getElementById('userBio').textContent = userProfile.bio || 'No bio yet';
    document.getElementById('userCity').textContent = userProfile.city || 'Not specified';
    document.getElementById('userRole').textContent = userProfile.role || 'user';
    document.getElementById('userStatus').textContent = userProfile.status || 'active';
    
    // Format and display dates
    if (userProfile.createdAt) {
        const memberSince = userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date(userProfile.createdAt);
        document.getElementById('memberSince').textContent = memberSince.toLocaleDateString();
        document.getElementById('profileCreatedTime').textContent = formatRelativeTime(memberSince);
    }
    
    // Form fields
    document.getElementById('displayName').value = userProfile.displayName || '';
    document.getElementById('fullName').value = userProfile.fullName || '';
    document.getElementById('nickName').value = userProfile.nickName || '';
    document.getElementById('bio').value = userProfile.bio || '';
    document.getElementById('city').value = userProfile.city || '';
    
    // Avatar
    if (userProfile.avatarUrl) {
        document.getElementById('avatarImage').src = userProfile.avatarUrl;
        document.getElementById('avatarImage').style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';
    } else {
        const name = userProfile.displayName || userProfile.fullName || userProfile.email || 'User';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('avatarInitials').textContent = initials;
    }
    
    updateStatusBadge();
    console.log('✅ Profile display complete');
}

async function loadUserStats() {
    if (!userProfile) return;
    
    console.log('📊 Loading user stats...');
    
    try {
        const stats = userProfile.stats || {};
        
        // Update sidebar stats
        document.getElementById('totalPosts').textContent = stats.postsCount || 0;
        document.getElementById('publishedCount').textContent = stats.publishedCount || 0;
        document.getElementById('draftsCount').textContent = stats.draftsCount || 0;
        
        // Update dashboard cards
        document.getElementById('totalPostsCard').textContent = stats.postsCount || 0;
        document.getElementById('publishedPostsCard').textContent = stats.publishedCount || 0;
        document.getElementById('draftPostsCard').textContent = stats.draftsCount || 0;
        
        // Calculate account age
        if (userProfile.createdAt) {
            const created = userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date(userProfile.createdAt);
            const today = new Date();
            const diffTime = Math.abs(today - created);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            document.getElementById('accountAge').textContent = diffDays;
        }
        
        await loadUserPosts();
        console.log('✅ Stats loading complete');
    } catch (error) {
        console.error('❌ Error loading stats:', error);
    }
}

async function loadUserPosts() {
    console.log('📝 Loading user posts...');
    
    try {
        const querySnapshot = await db.collection('posts')
            .where('authorId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const postsList = document.getElementById('postsList');
        const recentActivity = document.getElementById('recentActivity');
        
        postsList.innerHTML = '';
        recentActivity.innerHTML = '';
        
        if (querySnapshot.empty) {
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
            return;
        }
        
        let activityCount = 0;
        querySnapshot.forEach((doc) => {
            const post = doc.data();
            const postElement = createPostElement(post, doc.id);
            postsList.appendChild(postElement);
            
            if (activityCount < 3) {
                const activityElement = createActivityElement(post, doc.id);
                recentActivity.appendChild(activityElement);
                activityCount++;
            }
        });
        
        console.log('✅ Posts loading complete');
    } catch (error) {
        console.error('❌ Error loading posts:', error);
    }
}

function createPostElement(post, postId) {
    const div = document.createElement('div');
    const postDate = post.createdAt ? post.createdAt.toDate().toLocaleDateString() : 'Unknown date';
    const status = post.published ? 'published' : 'draft';
    const statusText = post.published ? 'Published' : 'Draft';
    
    div.className = `post-card ${status}`;
    div.innerHTML = `
        <div class="post-header">
            <h3 class="post-title">${post.title || 'Untitled Post'}</h3>
            <span class="post-status ${status}">${statusText}</span>
        </div>
        <div class="post-content">
            ${post.content ? (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content) : 'No content'}
        </div>
        <div class="post-meta">
            <span>Created: ${postDate}</span>
            <div class="post-actions">
                <button class="action-btn edit" onclick="editPost('${postId}')">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
                <button class="action-btn delete" onclick="deletePost('${postId}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `;
    
    return div;
}

function createActivityElement(post, postId) {
    const div = document.createElement('div');
    const postDate = post.createdAt ? post.createdAt.toDate() : new Date();
    const activityType = post.published ? 'published a post' : 'saved a draft';
    const icon = post.published ? 'fa-globe' : 'fa-edit';
    
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
    
    console.log('💾 Saving profile...');
    
    if (!validateForm()) {
        return;
    }
    
    showLoading(true);
    
    try {
        const updatedProfile = {
            displayName: document.getElementById('displayName').value.trim(),
            fullName: document.getElementById('fullName').value.trim(),
            nickName: document.getElementById('nickName').value.trim(),
            bio: document.getElementById('bio').value.trim(),
            city: document.getElementById('city').value.trim(),
            profileComplete: true,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: new Date().toISOString()
        };
        
        await db.collection('users').doc(currentUser.uid).update(updatedProfile);
        
        userProfile = { ...userProfile, ...updatedProfile };
        displayUserProfile();
        showStatus('Profile updated successfully!', 'success');
        console.log('✅ Profile saved successfully');
    } catch (error) {
        console.error('❌ Error saving profile:', error);
        showStatus('Error updating profile: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function saveProfileToFirestore() {
    return db.collection('users').doc(currentUser.uid).set(userProfile, { merge: true });
}

function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showStatus('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showStatus('Image size should be less than 5MB', 'error');
        return;
    }
    
    showLoading(true);
    
    const storageRef = storage.ref();
    const avatarRef = storageRef.child(`avatars/${currentUser.uid}/${file.name}`);
    
    avatarRef.put(file)
        .then((snapshot) => snapshot.ref.getDownloadURL())
        .then((downloadURL) => {
            return db.collection('users').doc(currentUser.uid).update({
                avatarUrl: downloadURL,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            userProfile.avatarUrl = downloadURL;
            displayUserProfile();
            showStatus('Avatar updated successfully!', 'success');
        })
        .catch((error) => {
            console.error('Error uploading avatar:', error);
            showStatus('Error uploading avatar: ' + error.message, 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

function validateForm() {
    const displayName = document.getElementById('displayName').value.trim();
    
    if (!displayName) {
        showStatus('Display name is required', 'error');
        return false;
    }
    
    return true;
}

function resetForm() {
    displayUserProfile();
    showStatus('Form reset to current values', 'warning');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.currentTarget.classList.add('active');
}

function filterPosts(filter) {
    const posts = document.querySelectorAll('.post-card');
    posts.forEach(post => {
        if (filter === 'all') {
            post.style.display = 'block';
        } else if (filter === 'published') {
            post.style.display = post.classList.contains('published') ? 'block' : 'none';
        } else if (filter === 'drafts') {
            post.style.display = post.classList.contains('draft') ? 'block' : 'none';
        }
    });
}

function editPost(postId) {
    window.location.href = `editor.html?postId=${postId}`;
}

function deletePost(postId) {
    if (confirm('Are you sure you want to delete this post?')) {
        db.collection('posts').doc(postId).delete()
            .then(() => {
                showStatus('Post deleted successfully', 'success');
                loadUserPosts();
                loadUserProfile();
            })
            .catch((error) => {
                console.error('Error deleting post:', error);
                showStatus('Error deleting post: ' + error.message, 'error');
            });
    }
}

function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showStatus('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showStatus('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showStatus('Password must be at least 6 characters long', 'error');
        return;
    }
    
    showLoading(true);
    
    const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email, 
        currentPassword
    );
    
    currentUser.reauthenticateWithCredential(credential)
        .then(() => currentUser.updatePassword(newPassword))
        .then(() => {
            showStatus('Password updated successfully!', 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        })
        .catch((error) => {
            console.error('Error changing password:', error);
            showStatus('Error changing password: ' + error.message, 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

function exportData() {
    showLoading(true);
    
    const exportData = {
        profile: userProfile,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `mindsribe-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showLoading(false);
    showStatus('Data exported successfully!', 'success');
}

function showDeleteModal() {
    document.getElementById('deleteModal').style.display = 'block';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    document.getElementById('deletePassword').value = '';
}

function deleteAccount() {
    const password = document.getElementById('deletePassword').value;
    
    if (!password) {
        showStatus('Please enter your password to confirm', 'error');
        return;
    }
    
    showLoading(true);
    
    const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email, 
        password
    );
    
    currentUser.reauthenticateWithCredential(credential)
        .then(() => db.collection('users').doc(currentUser.uid).delete())
        .then(() => deleteUserPosts())
        .then(() => currentUser.delete())
        .then(() => {
            showStatus('Account deleted successfully', 'success');
            setTimeout(() => window.location.href = 'index.html', 2000);
        })
        .catch((error) => {
            console.error('Error deleting account:', error);
            showStatus('Error deleting account: ' + error.message, 'error');
        })
        .finally(() => {
            showLoading(false);
            closeDeleteModal();
        });
}

function deleteUserPosts() {
    return db.collection('posts')
        .where('authorId', '==', currentUser.uid)
        .get()
        .then((querySnapshot) => {
            const batch = db.batch();
            querySnapshot.forEach((doc) => batch.delete(doc.ref));
            return batch.commit();
        });
}

function updateStatusBadge() {
    const statusBadge = document.getElementById('userStatus');
    const status = userProfile.status || 'active';
    
    statusBadge.className = 'status-badge';
    if (status === 'active') {
        statusBadge.style.background = '#10b981';
    } else if (status === 'inactive') {
        statusBadge.style.background = '#6b7280';
    } else if (status === 'suspended') {
        statusBadge.style.background = '#ef4444';
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 5000);
}

function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

// Make functions globally available
window.switchTab = switchTab;
window.filterPosts = filterPosts;
window.editPost = editPost;
window.deletePost = deletePost;
window.changePassword = changePassword;
window.exportData = exportData;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.deleteAccount = deleteAccount;
window.resetForm = resetForm;