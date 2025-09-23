// profile.js

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
                // Create default profile
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
    return {
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        email: currentUser.email,
        bio: '',
        website: '',
        location: '',
        avatarUrl: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function displayUserProfile() {
    // Basic info
    document.getElementById('userName').textContent = userProfile.displayName;
    document.getElementById('userEmail').textContent = userProfile.email;
    document.getElementById('userBio').textContent = userProfile.bio || 'No bio yet';
    
    // Member since
    if (userProfile.createdAt) {
        const memberSince = userProfile.createdAt.toDate();
        document.getElementById('memberSince').textContent = memberSince.toLocaleDateString();
    }
    
    // Form fields
    document.getElementById('displayName').value = userProfile.displayName || '';
    document.getElementById('bio').value = userProfile.bio || '';
    document.getElementById('website').value = userProfile.website || '';
    document.getElementById('location').value = userProfile.location || '';
    
    // Avatar
    if (userProfile.avatarUrl) {
        document.getElementById('avatarImage').src = userProfile.avatarUrl;
        document.getElementById('avatarImage').style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';
    } else {
        // Show initials
        const initials = userProfile.displayName 
            ? userProfile.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
            : 'U';
        document.getElementById('avatarInitials').textContent = initials;
    }
}

async function loadUserStats() {
    try {
        // Get published posts count
        const publishedSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('published').get();
        
        // Get drafts count
        const draftsSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('drafts').get();
        
        // Update stats
        document.getElementById('postsCount').textContent = publishedSnapshot.size;
        document.getElementById('draftsCount').textContent = draftsSnapshot.size;
        document.getElementById('totalPosts').textContent = publishedSnapshot.size + draftsSnapshot.size;
        document.getElementById('publishedPosts').textContent = publishedSnapshot.size;
        document.getElementById('draftPosts').textContent = draftsSnapshot.size;
        
        // Account age
        if (userProfile.createdAt) {
            const created = userProfile.createdAt.toDate();
            const today = new Date();
            const diffTime = Math.abs(today - created);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            document.getElementById('accountAge').textContent = diffDays;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadUserPosts() {
    try {
        // Load published posts
        const publishedSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('published')
            .orderBy('publishedAt', 'desc')
            .limit(5)
            .get();
        
        // Load drafts
        const draftsSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('drafts')
            .orderBy('updatedAt', 'desc')
            .limit(5)
            .get();
        
        displayRecentActivity(publishedSnapshot, draftsSnapshot);
        displayAllPosts(publishedSnapshot, draftsSnapshot);
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

function displayRecentActivity(publishedSnapshot, draftsSnapshot) {
    const container = document.getElementById('recentActivity');
    container.innerHTML = '';
    
    // Combine and sort by date
    const allPosts = [];
    
    publishedSnapshot.forEach(doc => {
        allPosts.push({
            id: doc.id,
            ...doc.data(),
            type: 'published',
            date: doc.data().publishedAt
        });
    });
    
    draftsSnapshot.forEach(doc => {
        allPosts.push({
            id: doc.id,
            ...doc.data(),
            type: 'draft',
            date: doc.data().updatedAt
        });
    });
    
    // Sort by date (newest first)
    allPosts.sort((a, b) => b.date - a.date);
    
    // Display latest 5
    allPosts.slice(0, 5).forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

function displayAllPosts(publishedSnapshot, draftsSnapshot) {
    const container = document.getElementById('postsList');
    container.innerHTML = '';
    
    // Add published posts
    publishedSnapshot.forEach(doc => {
        const post = {
            id: doc.id,
            ...doc.data(),
            type: 'published'
        };
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
    
    // Add drafts
    draftsSnapshot.forEach(doc => {
        const post = {
            id: doc.id,
            ...doc.data(),
            type: 'draft'
        };
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = `post-card ${post.type}`;
    
    const contentPreview = post.content 
        ? (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)
        : 'No content';
    
    const date = post.type === 'published' 
        ? post.publishedAt?.toDate().toLocaleDateString() 
        : post.updatedAt?.toDate().toLocaleDateString();
    
    div.innerHTML = `
        <div class="post-header">
            <h3 class="post-title">${post.title || 'Untitled'}</h3>
            <span class="post-status ${post.type}">${post.type === 'published' ? 'Published' : 'Draft'}</span>
        </div>
        <div class="post-content">${contentPreview}</div>
        <div class="post-meta">
            <span>Last updated: ${date}</span>
            <div class="post-actions">
                <button class="action-btn edit" onclick="editPost('${post.id}', '${post.type}')">Edit</button>
                <button class="action-btn delete" onclick="deletePost('${post.id}', '${post.type}')">Delete</button>
            </div>
        </div>
    `;
    
    return div;
}

function saveProfile(e) {
    e.preventDefault();
    showLoading(true);
    
    const updatedProfile = {
        displayName: document.getElementById('displayName').value.trim(),
        bio: document.getElementById('bio').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Update in Firestore
    db.collection('users').doc(currentUser.uid).update(updatedProfile)
        .then(() => {
            // Update local profile
            userProfile = { ...userProfile, ...updatedProfile };
            displayUserProfile();
            showStatus('Profile updated successfully!', 'success');
        })
        .catch((error) => {
            console.error('Error updating profile:', error);
            showStatus('Error updating profile', 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showStatus('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showStatus('Image size must be less than 5MB', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        // Upload to Firebase Storage
        const storageRef = storage.ref();
        const avatarRef = storageRef.child(`avatars/${currentUser.uid}/${file.name}`);
        const snapshot = await avatarRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        // Update profile with new avatar URL
        await db.collection('users').doc(currentUser.uid).update({
            avatarUrl: downloadURL,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local profile and display
        userProfile.avatarUrl = downloadURL;
        document.getElementById('avatarImage').src = downloadURL;
        document.getElementById('avatarImage').style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';
        
        showStatus('Avatar updated successfully!', 'success');
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showStatus('Error uploading avatar', 'error');
    } finally {
        showLoading(false);
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
        showStatus('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading(true);
    
    // Reauthenticate user first
    const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email, 
        currentPassword
    );
    
    currentUser.reauthenticateWithCredential(credential)
        .then(() => {
            // Change password
            return currentUser.updatePassword(newPassword);
        })
        .then(() => {
            showStatus('Password changed successfully!', 'success');
            // Clear password fields
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        })
        .catch((error) => {
            console.error('Error changing password:', error);
            if (error.code === 'auth/wrong-password') {
                showStatus('Current password is incorrect', 'error');
            } else {
                showStatus('Error changing password', 'error');
            }
        })
        .finally(() => {
            showLoading(false);
        });
}

function editPost(postId, type) {
    window.location.href = `editor.html?edit=${postId}`;
}

async function deletePost(postId, type) {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) {
        return;
    }
    
    try {
        if (type === 'published') {
            await db.collection('users').doc(currentUser.uid)
                .collection('published').doc(postId).delete();
        } else {
            await db.collection('users').doc(currentUser.uid)
                .collection('drafts').doc(postId).delete();
        }
        
        showStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`, 'success');
        // Reload posts
        loadUserStats();
        loadUserPosts();
    } catch (error) {
        console.error('Error deleting post:', error);
        showStatus('Error deleting post', 'error');
    }
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

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Activate selected button
    event.target.classList.add('active');
}

function showDeleteModal() {
    document.getElementById('deleteModal').style.display = 'block';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    document.getElementById('deletePassword').value = '';
}

async function deleteAccount() {
    const password = document.getElementById('deletePassword').value;
    
    if (!password) {
        showStatus('Please enter your password', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        // Reauthenticate
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email, 
            password
        );
        
        await currentUser.reauthenticateWithCredential(credential);
        
        // Delete user data from Firestore
        await deleteUserData();
        
        // Delete user account
        await currentUser.delete();
        
        showStatus('Account deleted successfully. Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        if (error.code === 'auth/wrong-password') {
            showStatus('Incorrect password', 'error');
        } else {
            showStatus('Error deleting account', 'error');
        }
    } finally {
        showLoading(false);
        closeDeleteModal();
    }
}

async function deleteUserData() {
    // Delete all user documents
    const batch = db.batch();
    
    // Delete published posts
    const publishedSnapshot = await db.collection('users').doc(currentUser.uid)
        .collection('published').get();
    publishedSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    // Delete drafts
    const draftsSnapshot = await db.collection('users').doc(currentUser.uid)
        .collection('drafts').get();
    draftsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    // Delete user profile
    batch.delete(db.collection('users').doc(currentUser.uid));
    
    await batch.commit();
}

function exportData() {
    showStatus('Preparing your data export...', 'warning');
    // In a real application, you would generate and download a JSON file
    // This is a simplified version
    setTimeout(() => {
        showStatus('Data export feature coming soon!', 'success');
    }, 2000);
}

function resetForm() {
    document.getElementById('profileForm').reset();
    displayUserProfile(); // Reset to current values
}

function validateForm() {
    const displayName = document.getElementById('displayName').value;
    if (displayName.length > 50) {
        showStatus('Display name must be less than 50 characters', 'error');
    }
}

function saveProfileToFirestore() {
    db.collection('users').doc(currentUser.uid).set(userProfile)
        .then(() => {
            console.log('Default profile created');
        })
        .catch((error) => {
            console.error('Error creating profile:', error);
        });
}

// Utility functions
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}