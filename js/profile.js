// profile.js - Compact Version
let currentUser, userProfile = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeProfile();
});

function initializeProfile() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            db = firebase.firestore();
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
            displayUserProfile();
            await loadUserStats();
        } else {
            userProfile = createDefaultProfile();
            await saveProfileToFirestore();
            displayUserProfile();
            await loadUserStats();
        }
    } catch (error) {
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        stats: { draftsCount: 0, postsCount: 0, publishedCount: 0 }
    };
}

function displayUserProfile() {
    if (!userProfile) return;
    
    document.getElementById('userName').textContent = userProfile.displayName || 'User';
    document.getElementById('userEmail').textContent = userProfile.email;
    document.getElementById('userBio').textContent = userProfile.bio || 'No bio yet';
    document.getElementById('userCity').textContent = userProfile.city || 'Not specified';
    document.getElementById('userRole').textContent = userProfile.role;
    
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
    if (!userProfile) return;
    
    const stats = userProfile.stats || {};
    
    document.getElementById('totalPosts').textContent = stats.postsCount || 0;
    document.getElementById('publishedCount').textContent = stats.publishedCount || 0;
    document.getElementById('draftsCount').textContent = stats.draftsCount || 0;
    
    document.getElementById('totalPostsCard').textContent = stats.postsCount || 0;
    document.getElementById('publishedPostsCard').textContent = stats.publishedCount || 0;
    document.getElementById('draftPostsCard').textContent = stats.draftsCount || 0;
    
    if (userProfile.createdAt) {
        const created = userProfile.createdAt.toDate();
        const diffDays = Math.ceil((new Date() - created) / (1000 * 60 * 60 * 24));
        document.getElementById('accountAge').textContent = diffDays;
    }
    
    await loadUserPosts();
}

async function loadUserPosts() {
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
            postsList.innerHTML = '<div style="text-align: center; padding: 3rem; color: #6b7280;">No posts yet</div>';
            recentActivity.innerHTML = '<div class="activity-item">No recent activity</div>';
            return;
        }
        
        let activityCount = 0;
        querySnapshot.forEach((doc) => {
            const post = doc.data();
            postsList.appendChild(createPostElement(post, doc.id));
            
            if (activityCount < 3) {
                recentActivity.appendChild(createActivityElement(post));
                activityCount++;
            }
        });
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

function createPostElement(post, postId) {
    const div = document.createElement('div');
    const status = post.published ? 'published' : 'draft';
    
    div.className = `post-card ${status}`;
    div.innerHTML = `
        <div class="post-header">
            <h3 class="post-title">${post.title || 'Untitled'}</h3>
            <span class="post-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
        <div class="post-content">${post.content?.substring(0, 150) || 'No content'}...</div>
        <div class="post-meta">
            <span>Created: ${post.createdAt?.toDate().toLocaleDateString() || 'Unknown'}</span>
            <div class="post-actions">
                <button class="action-btn edit" onclick="editPost('${postId}')">Edit</button>
                <button class="action-btn delete" onclick="deletePost('${postId}')">Delete</button>
            </div>
        </div>
    `;
    
    return div;
}

function createActivityElement(post) {
    const div = document.createElement('div');
    const activityType = post.published ? 'published a post' : 'saved a draft';
    
    div.className = 'activity-item';
    div.innerHTML = `
        <div class="activity-icon">
            <i class="fas ${post.published ? 'fa-globe' : 'fa-edit'}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-title">You ${activityType}</div>
            <div class="activity-time">${formatRelativeTime(post.createdAt?.toDate() || new Date())}</div>
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
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('users').doc(currentUser.uid).update(updatedProfile);
        userProfile = { ...userProfile, ...updatedProfile };
        displayUserProfile();
        showStatus('Profile updated successfully!', 'success');
    } catch (error) {
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
        .catch(error => showStatus('Error uploading avatar', 'error'))
        .finally(() => showLoading(false));
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.currentTarget.classList.add('active');
}

function filterPosts(type) {
    document.querySelectorAll('.post-card').forEach(post => {
        post.style.display = type === 'all' ? 'block' : 
                           post.classList.contains(type) ? 'block' : 'none';
    });
}

function editPost(postId) {
    window.location.href = `editor.html?postId=${postId}`;
}

function deletePost(postId) {
    if (confirm('Delete this post?')) {
        db.collection('posts').doc(postId).delete()
            .then(() => {
                showStatus('Post deleted', 'success');
                loadUserPosts();
                loadUserProfile();
            })
            .catch(error => showStatus('Error deleting post', 'error'));
    }
}

function resetForm() {
    displayUserProfile();
    showStatus('Form reset', 'warning');
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