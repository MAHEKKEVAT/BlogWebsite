// editor.js - UPDATED FOR USER COLLECTION STRUCTURE

// Global variables
let currentUser = null;
let currentPostId = null;
let autoSaveInterval = null;
let isSaving = false;

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Editor initializing...');
    initializeEditor();
});

async function initializeEditor() {
    try {
        // Wait for Firebase to be ready
        await waitForFirebase();
        
        // Set up authentication state listener
        setupAuthListener();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check if we're editing an existing post
        checkEditMode();
        
        console.log('✅ Editor initialized successfully');
        
    } catch (error) {
        console.error('❌ Editor initialization failed:', error);
        showStatus('Failed to initialize editor. Please refresh the page.', 'error');
    }
}

function waitForFirebase() {
    return new Promise((resolve, reject) => {
        const checkFirebase = () => {
            if (window.firebaseDb && window.firebaseAuth) {
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
        
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Firebase timeout')), 5000);
    });
}

function setupAuthListener() {
    window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log('✅ User authenticated:', user.email);
            enableEditor();
        } else {
            console.log('❌ No user, redirecting to login...');
            window.location.href = 'index.html';
        }
    });
}

function enableEditor() {
    // Enable form inputs
    const titleInput = document.getElementById('postTitle');
    const contentInput = document.getElementById('postContent');
    
    if (titleInput && contentInput) {
        titleInput.disabled = false;
        contentInput.disabled = false;
    }
    
    // Enable buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.id !== 'publishPost') { // Keep publish disabled until valid
            btn.disabled = false;
        }
    });
    
    showStatus('Editor ready. Start writing!', 'success');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Save Draft button
    const saveDraftBtn = document.getElementById('saveDraft');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', handleSaveDraft);
        console.log('✅ Save Draft listener added');
    } else {
        console.error('❌ Save Draft button not found');
    }
    
    // Preview button
    const previewBtn = document.getElementById('previewPost');
    if (previewBtn) {
        previewBtn.addEventListener('click', handlePreview);
        console.log('✅ Preview listener added');
    }
    
    // Publish button
    const publishBtn = document.getElementById('publishPost');
    if (publishBtn) {
        publishBtn.addEventListener('click', handlePublish);
        console.log('✅ Publish listener added');
    }
    
    // Real-time validation
    const titleInput = document.getElementById('postTitle');
    const contentInput = document.getElementById('postContent');
    
    if (titleInput) {
        titleInput.addEventListener('input', updateWordCount);
        titleInput.addEventListener('input', validateForm);
        console.log('✅ Title input listeners added');
    }
    
    if (contentInput) {
        contentInput.addEventListener('input', updateWordCount);
        contentInput.addEventListener('input', validateForm);
        console.log('✅ Content input listeners added');
    }
    
    // Auto-save every 30 seconds
    autoSaveInterval = setInterval(() => {
        if (!isSaving) {
            autoSaveDraft();
        }
    }, 30000);
    
    // Close preview when clicking outside
    document.addEventListener('click', (event) => {
        const modal = document.getElementById('previewModal');
        if (event.target === modal) {
            closePreview();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
        switch(event.key) {
            case 's':
                event.preventDefault();
                handleSaveDraft();
                break;
            case 'p':
                event.preventDefault();
                handlePreview();
                break;
        }
    }
    
    if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        switch(event.key) {
            case 'P':
                event.preventDefault();
                if (!document.getElementById('publishPost').disabled) {
                    handlePublish();
                }
                break;
            case 'S':
                event.preventDefault();
                handleSaveDraft();
                break;
        }
    }
}

function updateWordCount() {
    const content = document.getElementById('postContent').value;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    
    document.getElementById('wordCount').textContent = `${words} words`;
    document.getElementById('charCount').textContent = `${chars} characters`;
}

function validateForm() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const publishBtn = document.getElementById('publishPost');
    
    if (publishBtn) {
        const isValid = title && content;
        publishBtn.disabled = !isValid;
        publishBtn.title = isValid ? 'Publish this post' : 'Add title and content to publish';
    }
}

function checkEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('edit');
    
    if (postId) {
        console.log('✏️ Edit mode detected for post:', postId);
        loadPostForEditing(postId);
    } else {
        console.log('📝 Creating new post');
        showStatus('Start writing your new post...', 'info');
    }
}

async function loadPostForEditing(postId) {
    showLoading(true);
    
    try {
        console.log('📖 Loading post for editing:', postId);
        
        // Try drafts first
        const draftDoc = await window.firebaseDb.collection('users').doc(currentUser.uid)
            .collection('drafts').doc(postId).get();
            
        if (draftDoc.exists) {
            const post = draftDoc.data();
            document.getElementById('postTitle').value = post.title || '';
            document.getElementById('postContent').value = post.content || '';
            currentPostId = postId;
            updateWordCount();
            validateForm();
            showStatus('Draft loaded successfully', 'success');
            console.log('📄 Draft loaded:', post.title);
            return;
        }
        
        // Try published posts
        const publishedDoc = await window.firebaseDb.collection('users').doc(currentUser.uid)
            .collection('published').doc(postId).get();
            
        if (publishedDoc.exists) {
            const post = publishedDoc.data();
            document.getElementById('postTitle').value = post.title || '';
            document.getElementById('postContent').value = post.content || '';
            currentPostId = postId;
            updateWordCount();
            validateForm();
            showStatus('Published post loaded for editing', 'success');
            console.log('📄 Published post loaded:', post.title);
            return;
        }
        
        showStatus('Post not found', 'error');
        console.error('❌ Post not found:', postId);
        
    } catch (error) {
        console.error('❌ Error loading post:', error);
        showStatus('Error loading post: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleSaveDraft() {
    if (isSaving) {
        console.log('⏳ Already saving, please wait...');
        return;
    }
    
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    
    if (!title && !content) {
        showStatus('Cannot save empty draft', 'warning');
        return;
    }
    
    isSaving = true;
    showLoading(true);
    
    try {
        const postData = {
            title: title,
            content: content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userDisplayName: currentUser.displayName || currentUser.email.split('@')[0],
            wordCount: content.length,
            excerpt: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
            status: 'draft',
            readTime: Math.ceil(content.split(/\s+/).length / 200)
        };
        
        if (currentPostId) {
            // Update existing draft
            await window.firebaseDb.collection('users').doc(currentUser.uid)
                .collection('drafts').doc(currentPostId)
                .update(postData);
            console.log('💾 Draft updated:', currentPostId);
        } else {
            // Create new draft
            postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await window.firebaseDb.collection('users').doc(currentUser.uid)
                .collection('drafts').add(postData);
            currentPostId = docRef.id;
            console.log('💾 New draft created:', currentPostId);
        }
        
        showStatus('Draft saved successfully!', 'success');
        updateURLWithPostId();
        
    } catch (error) {
        console.error('❌ Error saving draft:', error);
        showStatus('Error saving draft: ' + error.message, 'error');
    } finally {
        isSaving = false;
        showLoading(false);
    }
}

function autoSaveDraft() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    
    if ((title || content) && currentUser && !isSaving) {
        console.log('⏰ Auto-saving draft...');
        handleSaveDraft().catch(error => {
            console.log('Auto-save failed:', error);
        });
    }
}

async function handlePublish() {
    if (isSaving) {
        console.log('⏳ Already saving, please wait...');
        return;
    }
    
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    
    if (!title) {
        showStatus('Please add a title before publishing', 'error');
        return;
    }
    
    if (!content) {
        showStatus('Please add content before publishing', 'error');
        return;
    }
    
    isSaving = true;
    showLoading(true);
    
    try {
        const postData = {
            title: title,
            content: content,
            publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userDisplayName: currentUser.displayName || currentUser.email.split('@')[0],
            status: 'published',
            wordCount: content.length,
            excerpt: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            readTime: Math.ceil(content.split(/\s+/).length / 200)
        };
        
        if (currentPostId) {
            // Check if it's a draft being published
            const draftDoc = await window.firebaseDb.collection('users').doc(currentUser.uid)
                .collection('drafts').doc(currentPostId).get();
                
            if (draftDoc.exists) {
                // Move from drafts to published
                const batch = window.firebaseDb.batch();
                
                // Add to published
                const publishedRef = window.firebaseDb.collection('users').doc(currentUser.uid)
                    .collection('published').doc(currentPostId);
                batch.set(publishedRef, {
                    ...postData,
                    createdAt: draftDoc.data().createdAt || firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Remove from drafts
                const draftRef = window.firebaseDb.collection('users').doc(currentUser.uid)
                    .collection('drafts').doc(currentPostId);
                batch.delete(draftRef);
                
                await batch.commit();
                console.log('🚀 Draft moved to published:', currentPostId);
                
            } else {
                // Update existing published post
                await window.firebaseDb.collection('users').doc(currentUser.uid)
                    .collection('published').doc(currentPostId)
                    .update(postData);
                console.log('✏️ Published post updated:', currentPostId);
            }
        } else {
            // Create new published post
            postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await window.firebaseDb.collection('users').doc(currentUser.uid)
                .collection('published').add(postData);
            currentPostId = docRef.id;
            console.log('🚀 New post published:', currentPostId);
        }
        
        showStatus('✅ Post published successfully! Redirecting...', 'success');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error publishing post:', error);
        showStatus('Error publishing post: ' + error.message, 'error');
    } finally {
        isSaving = false;
        showLoading(false);
    }
}

function handlePreview() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    
    if (!title && !content) {
        showStatus('Nothing to preview', 'warning');
        return;
    }
    
    const previewContent = document.getElementById('previewContent');
    
    // Basic Markdown to HTML conversion
    const formattedContent = content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    previewContent.innerHTML = `
        <article class="preview-article">
            <header class="preview-header">
                <h1>${title || 'Untitled Post'}</h1>
                <div class="preview-meta">
                    <span>By ${currentUser.displayName || currentUser.email}</span> • 
                    <span>${new Date().toLocaleDateString()}</span> •
                    <span>${content.split(/\s+/).length} words</span> •
                    <span>${Math.ceil(content.split(/\s+/).length / 200)} min read</span>
                </div>
            </header>
            
            <div class="preview-body">
                ${formattedContent || '<p class="no-content">No content yet...</p>'}
            </div>
            
            <footer class="preview-footer">
                <p><em>Preview generated on ${new Date().toLocaleString()}</em></p>
            </footer>
        </article>
    `;
    
    // Show the modal
    document.getElementById('previewModal').style.display = 'block';
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

function updateURLWithPostId() {
    if (currentPostId && !window.location.search.includes('edit=')) {
        const newUrl = `${window.location.pathname}?edit=${currentPostId}`;
        window.history.replaceState({}, '', newUrl);
    }
}

// Text formatting functions
function formatText(format) {
    const textarea = document.getElementById('postContent');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = '';
    let cursorAdjustment = 0;
    
    switch(format) {
        case 'bold':
            formattedText = `**${selectedText}**`;
            cursorAdjustment = 2;
            break;
        case 'italic':
            formattedText = `*${selectedText}*`;
            cursorAdjustment = 1;
            break;
        case 'code':
            formattedText = `\`${selectedText}\``;
            cursorAdjustment = 1;
            break;
        default:
            formattedText = selectedText;
    }
    
    textarea.value = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    
    // Restore cursor position
    const newPosition = start + (selectedText ? cursorAdjustment : formattedText.length);
    textarea.selectionStart = newPosition;
    textarea.selectionEnd = newPosition;
    textarea.focus();
}

function insertBullet() {
    const textarea = document.getElementById('postContent');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(start);
    
    // Check if we're at the beginning of a line
    const lineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.substring(lineStart);
    
    if (currentLine.trim() === '') {
        textarea.value = before + '• ' + after;
        textarea.selectionStart = start + 2;
    } else {
        textarea.value = before + '\n• ' + after;
        textarea.selectionStart = start + 3;
    }
    
    textarea.selectionEnd = textarea.selectionStart;
    textarea.focus();
}

function insertLink() {
    const url = prompt('Enter URL:');
    if (!url) return;
    
    const text = prompt('Enter link text:', 'Link');
    if (text === null) return;
    
    const textarea = document.getElementById('postContent');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const linkText = `[${text || 'Link'}](${url})`;
    
    textarea.value = textarea.value.substring(0, start) + linkText + textarea.value.substring(start);
    textarea.selectionStart = start + linkText.length;
    textarea.selectionEnd = start + linkText.length;
    textarea.focus();
}

// Utility functions
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) {
        console.log('Status message element not found');
        return;
    }
    
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

// Cleanup
window.addEventListener('beforeunload', function(event) {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
});

// Make functions globally available
window.formatText = formatText;
window.insertBullet = insertBullet;
window.insertLink = insertLink;
window.closePreview = closePreview;
window.logout = logout;

console.log('✅ Editor JavaScript loaded completely');