// profile.js - Updated for Dashboard UI

// Firebase initialization
let db;
let storage;
let currentUser;
let userProfile = null;

// Initialize profile page
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();
    setupEventListeners();
});

function initializeFirebase() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            db = firebase.firestore();
            storage = firebase.storage();
            loadUserProfile();
            loadUserStats();
            loadUserPosts();
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
        }
    });
}

function setupEventListeners() {
    // Profile form submission
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    
    // Avatar upload
    document.getElementById('avatarUpload').addEventListener('change', uploadAvatar);
    
    // Real-time form validation
    document.getElementById('displayName').addEventListener('input', validateForm);
}

function loadUserProfile() {
    showLoading(true);
    
    // Load user profile from Firestore
    db.collection('users').doc(currentUser.uid).get()
        .then((doc) => {
            if (doc.exists) {
                userProfile = doc.data();
                displayUserProfile();
            } else {
                // Create default profile using the provided user data
                userProfile = createDefaultProfile();
                saveProfileToFirestore();
            }
        })
        .catch((error) => {
            console.error('Error loading profile:', error);
            showStatus('Error loading profile', 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

function createDefaultProfile() {
    // Use the provided user data structure
    return {
        displayName: "kartik",
        email: "kartik@gmail.com",
        fullName: "KARTIK",
        nickName: "kartik",
        city: "SURAT",
        bio: '',
        website: '',
        location: '',
        avatarUrl: '',
        emailVerified: false,
        profileComplete: true,
        role: "user",
        status: "active",
        createdAt: new Date("24 September 2025 11:29:49 GMT+0530"),
        lastLogin: new Date("24 September 2025 11:29:49 GMT+0530"),
        lastActive: "2025-09-24T05:59:23.229Z",
        stats: {
            draftsCount: 0,
            postsCount: 0,
            publishedCount: 0
        }
    };
}

function displayUserProfile() {
    // Basic info
    document.getElementById('userName').textContent = userProfile.displayName || userProfile.fullName || 'User';
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
        // Show initials from display name or full name
        const name = userProfile.displayName || userProfile.fullName || 'User';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('avatarInitials').textContent = initials;
    }
    
    // Update status badge color based on status
    updateStatusBadge();
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

function loadUserStats() {
    if (!userProfile) return;
    
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
}

function loadUserPosts() {
    // Load user's posts from Firestore
    db.collection('posts')
        .where('authorId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get()
        .then((querySnapshot) => {
            const postsList = document.getElementById('postsList');
            postsList.innerHTML = '';
            
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
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const post = doc.data();
                const postElement = createPostElement(post, doc.id);
                postsList.appendChild(postElement);
            });
        })
        .catch((error) => {
            console.error('Error loading posts:', error);
        });
}

function createPostElement(post, postId) {
    const postDate = post.createdAt ? post.createdAt.toDate().toLocaleDateString() : 'Unknown date';
    const status = post.published ? 'published' : 'draft';
    
    return document.createElement('div').innerHTML = `
        <div class="post-card ${status}">
            <div class="post-header">
                <h3 class="post-title">${post.title || 'Untitled Post'}</h3>
                <span class="post-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </div>
            <div class="post-content">
                ${post.content ? post.content.substring(0, 200) + '...' : 'No content'}
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
        </div>
    `;
}

function saveProfile(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    showLoading(true);
    
    // Update user profile object
    userProfile.displayName = document.getElementById('displayName').value;
    userProfile.fullName = document.getElementById('fullName').value;
    userProfile.nickName = document.getElementById('nickName').value;
    userProfile.bio = document.getElementById('bio').value;
    userProfile.city = document.getElementById('city').value;
    userProfile.updatedAt = new Date();
    
    saveProfileToFirestore()
        .then(() => {
            showStatus('Profile updated successfully!', 'success');
            displayUserProfile(); // Refresh display
        })
        .catch((error) => {
            console.error('Error saving profile:', error);
            showStatus('Error updating profile', 'error');
        })
        .finally(() => {
            showLoading(false);
        });
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
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showStatus('Image size should be less than 5MB', 'error');
        return;
    }
    
    showLoading(true);
    
    const storageRef = storage.ref();
    const avatarRef = storageRef.child(`avatars/${currentUser.uid}/${file.name}`);
    
    avatarRef.put(file)
        .then((snapshot) => snapshot.ref.getDownloadURL())
        .then((downloadURL) => {
            userProfile.avatarUrl = downloadURL;
            return saveProfileToFirestore();
        })
        .then(() => {
            showStatus('Avatar updated successfully!', 'success');
            displayUserProfile(); // Refresh avatar display
        })
        .catch((error) => {
            console.error('Error uploading avatar:', error);
            showStatus('Error uploading avatar', 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

function validateForm() {
    const displayName = document.getElementById('displayName').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    
    if (!displayName) {
        showStatus('Display name is required', 'error');
        return false;
    }
    
    if (!fullName) {
        showStatus('Full name is required', 'error');
        return false;
    }
    
    return true;
}

function resetForm() {
    displayUserProfile(); // Reset to current values
    showStatus('Form reset to current values', 'warning');
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Activate selected tab button
    event.currentTarget.classList.add('active');
}

function filterPosts(filter) {
    // This would filter the posts list based on the selected filter
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
    // Redirect to editor with post ID
    window.location.href = `editor.html?postId=${postId}`;
}

function deletePost(postId) {
    if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        db.collection('posts').doc(postId).delete()
            .then(() => {
                showStatus('Post deleted successfully', 'success');
                loadUserPosts(); // Refresh posts list
                loadUserStats(); // Refresh stats
            })
            .catch((error) => {
                console.error('Error deleting post:', error);
                showStatus('Error deleting post', 'error');
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
    
    // Reauthenticate user
    const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email, 
        currentPassword
    );
    
    currentUser.reauthenticateWithCredential(credential)
        .then(() => {
            return currentUser.updatePassword(newPassword);
        })
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
    
    // Export user data as JSON
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
    
    // Reauthenticate and delete account
    const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email, 
        password
    );
    
    currentUser.reauthenticateWithCredential(credential)
        .then(() => {
            // Delete user data first
            return db.collection('users').doc(currentUser.uid).delete();
        })
        .then(() => {
            // Delete user posts
            return deleteUserPosts();
        })
        .then(() => {
            // Delete user account
            return currentUser.delete();
        })
        .then(() => {
            showStatus('Account deleted successfully', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
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
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            return batch.commit();
        });
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