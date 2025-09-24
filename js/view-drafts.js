// View Drafts JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeDraftsPage();
});

async function initializeDraftsPage() {
    try {
        await checkFirebaseConnection();
        setupEventListeners();
        loadDrafts();
    } catch (error) {
        console.error('Drafts page initialization failed:', error);
        showError('Failed to load drafts');
    }
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterDrafts);
    }

    // Sort functionality
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', sortDrafts);
    }

    // Logout functionality
    document.querySelector('.logout-btn').addEventListener('click', () => {
        showLogoutModal();
    });
}

async function loadDrafts() {
    const user = window.firebaseAuth.currentUser;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    showLoading(true);

    try {
        const draftsSnapshot = await window.firebaseDb.collection('users').doc(user.uid)
            .collection('drafts')
            .orderBy('updatedAt', 'desc')
            .get();

        displayDrafts(draftsSnapshot);
        updateStats(draftsSnapshot);
        
    } catch (error) {
        console.error('Error loading drafts:', error);
        showError('Failed to load drafts');
    } finally {
        showLoading(false);
    }
}

function displayDrafts(draftsSnapshot) {
    const container = document.getElementById('drafts-container');
    
    if (draftsSnapshot.empty) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-edit"></i>
                </div>
                <h3>No drafts yet</h3>
                <p>Start writing to see your drafts appear here</p>
                <a href="editor.html" class="btn-primary">
                    <i class="fas fa-plus"></i>
                    Create First Draft
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = draftsSnapshot.docs.map(doc => {
        const draft = doc.data();
        return createDraftCard(doc.id, draft);
    }).join('');
}

function createDraftCard(draftId, draft) {
    const wordCount = draft.content ? draft.content.split(/\s+/).length : 0;
    const readTime = Math.ceil(wordCount / 200);
    const updatedDate = draft.updatedAt ? draft.updatedAt.toDate() : new Date();
    
    return `
        <div class="draft-card" data-title="${draft.title?.toLowerCase() || ''}">
            <div class="draft-header">
                <h3 class="draft-title">${draft.title || 'Untitled Draft'}</h3>
                <div class="draft-meta">
                    <span class="draft-badge">DRAFT</span>
                </div>
            </div>
            
            <p class="draft-excerpt">${draft.excerpt || 'No content yet...'}</p>
            
            <div class="draft-stats">
                <span>${wordCount} words</span>
                <span>${readTime} min read</span>
                <span>${formatDate(updatedDate)}</span>
            </div>
            
            <div class="draft-actions">
                <button class="draft-btn btn-edit" onclick="editDraft('${draftId}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="draft-btn btn-publish" onclick="publishDraft('${draftId}')">
                    <i class="fas fa-paper-plane"></i> Publish
                </button>
                <button class="draft-btn btn-delete" onclick="deleteDraft('${draftId}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

function updateStats(draftsSnapshot) {
    const totalDrafts = draftsSnapshot.size;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentDrafts = draftsSnapshot.docs.filter(doc => {
        const updatedAt = doc.data().updatedAt;
        return updatedAt && updatedAt.toDate() > weekAgo;
    }).length;

    const totalWords = draftsSnapshot.docs.reduce((sum, doc) => {
        const content = doc.data().content || '';
        return sum + content.split(/\s+/).length;
    }, 0);
    
    const avgWords = totalDrafts > 0 ? Math.round(totalWords / totalDrafts) : 0;

    document.getElementById('totalDrafts').textContent = totalDrafts;
    document.getElementById('recentDrafts').textContent = recentDrafts;
    document.getElementById('avgWords').textContent = avgWords;
}

function filterDrafts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const drafts = document.querySelectorAll('.draft-card');
    
    drafts.forEach(draft => {
        const title = draft.dataset.title;
        const shouldShow = title.includes(searchTerm);
        draft.style.display = shouldShow ? 'block' : 'none';
    });
}

function sortDrafts() {
    const sortValue = document.getElementById('sortSelect').value;
    // Implementation for sorting logic
    console.log('Sort by:', sortValue);
}

function editDraft(draftId) {
    window.location.href = `editor.html?edit=${draftId}`;
}

async function publishDraft(draftId) {
    if (!confirm('Publish this draft?')) return;

    try {
        const user = window.firebaseAuth.currentUser;
        const draftDoc = await window.firebaseDb.collection('users').doc(user.uid)
            .collection('drafts').doc(draftId).get();
            
        if (draftDoc.exists) {
            const draftData = draftDoc.data();
            const batch = window.firebaseDb.batch();
            
            // Add to published
            const publishedRef = window.firebaseDb.collection('users').doc(user.uid)
                .collection('published').doc(draftId);
            batch.set(publishedRef, {
                ...draftData,
                publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'published'
            });
            
            // Remove from drafts
            const draftRef = window.firebaseDb.collection('users').doc(user.uid)
                .collection('drafts').doc(draftId);
            batch.delete(draftRef);
            
            await batch.commit();
            showSuccess('Draft published successfully!');
            loadDrafts();
        }
    } catch (error) {
        console.error('Error publishing draft:', error);
        showError('Failed to publish draft');
    }
}

async function deleteDraft(draftId) {
    if (!confirm('Delete this draft permanently?')) return;

    try {
        const user = window.firebaseAuth.currentUser;
        await window.firebaseDb.collection('users').doc(user.uid)
            .collection('drafts').doc(draftId).delete();
            
        showSuccess('Draft deleted successfully!');
        loadDrafts();
    } catch (error) {
        console.error('Error deleting draft:', error);
        showError('Failed to delete draft');
    }
}

// Utility functions
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(show) {
    const loadingState = document.getElementById('loading-state');
    const container = document.getElementById('drafts-container');
    
    if (loadingState) loadingState.style.display = show ? 'block' : 'none';
    if (container) container.style.display = show ? 'none' : 'grid';
}

function showSuccess(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-success';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success);
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
    // Create error notification
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
    // Simple logout confirmation
    if (confirm('Are you sure you want to logout?')) {
        window.firebaseAuth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}