// Trendit Social Application Client Core
const firebaseConfig = {
    apiKey: "AIzaSyDn2cYKArmlHgfva7QFOtpOFppemZVdpjk",
    authDomain: "trend-it-c7ea4.firebaseapp.com",
    projectId: "trend-it-c7ea4",
    storageBucket: "trend-it-c7ea4.firebasestorage.app",
    messagingSenderId: "757837469928",
    appId: "1:757837469928:web:8ef7173ec5a465a5db515d",
    measurementId: "G-83210NQE5W"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Enforce Local Session Persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let currentUser = null;
let allPosts = [];
let followingList = [];
let bookmarks = JSON.parse(localStorage.getItem('trendit_bookmarks') || '[]');
let activeThreadPostId = null;
let unsubscribeReplies = null;
let currentProfileUserId = null;
let currentFeedTab = 'foryou';
let isPollActive = false;
let selectedMediaData = null;
let dmUsersCache = [];
let dmSearchResultsCache = [];
let dmSearchRequestId = 0;
let pendingDmUserId = null;
let activeDmUserId = null;
let activeDmThreadId = null;
let unsubscribeDmMessages = null;
let dmSearchTerm = '';

// Agora RTC Layer
let agoraClient = null;
let agoraLocalAudioTrack = null;
let agoraLocalVideoTrack = null;
let agoraRemoteUsers = new Map();
let agoraJoinedChannel = null;
let activeCallType = null;
let activeCallDocId = null;
let unsubscribeCallDoc = null;
let unsubscribeIncomingCalls = null;
let activeIncomingCallId = null;
let callConnectedAtMs = null;
let callHistoryWritten = false;
let ringtoneAudioContext = null;
let ringtoneTimer = null;

const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#2f3336"/><circle cx="60" cy="43" r="23" fill="#71767b"/><path d="M20 108c5-25 20-38 40-38s35 13 40 38" fill="#71767b"/></svg>'
);

const TRENDIt_AGORA_APP_ID = '02fde73deba244599248162cca0c8baf';

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();
        
        if (!userDoc.exists) {
            await userDocRef.set({
                uid: user.uid,
                displayName: user.displayName || 'User',
                handle: user.email ? user.email.split('@')[0] : 'user_' + user.uid.substring(0, 5),
                age: 18,
                gender: 'Prefer not to say',
                bio: 'Hey there! I am using Trendit.',
                email: user.email || '',
                photoURL: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        currentUser = (await userDocRef.get()).data();
        document.getElementById('authLandingView').style.display = 'none';
        document.getElementById('mainAppContent').style.display = 'flex';
        document.getElementById('authBtn').style.display = 'block';
        document.getElementById('bottomNav').style.display = 'flex';
        
        const avatarUrl = currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.handle}`;
        document.getElementById('userAvatarInput').src = avatarUrl;
        
        initFollowingListener();
        initRealtimeFeed();
        initRealtimeNotifications();
        initIncomingCallListener();
    } else {
        currentUser = null;
        document.getElementById('authLandingView').style.display = 'flex';
        document.getElementById('mainAppContent').style.display = 'none';
        document.getElementById('authBtn').style.display = 'none';
        document.getElementById('bottomNav').style.display = 'none';
    }
});

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (tab === 'signin') {
        document.getElementById('tabSignIn').classList.add('active');
        document.getElementById('signInForm').classList.add('active');
    } else {
        document.getElementById('tabRegister').classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

async function handleEmailSignIn() {
    const email = document.getElementById('signInEmail').value;
    const password = document.getElementById('signInPassword').value;
    if (!email || !password) {
        alert('Please fill in all fields.');
        return;
    }
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert(error.message);
    }
}

async function handleEmailRegister() {
    const fullName = document.getElementById('regFullName').value;
    const handle = document.getElementById('regHandle').value.trim().toLowerCase();
    const age = document.getElementById('regAge').value;
    const gender = document.getElementById('regGender').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    if (!fullName || !handle || !age || !gender || !email || !password) {
        alert('Please complete all registration fields.');
        return;
    }
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            displayName: fullName,
            handle: handle,
            age: Number(age),
            gender: gender,
            bio: 'New Trendit member!',
            email: email,
            photoURL: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert(error.message);
    }
}

document.getElementById('landingSignInGoogleBtn').addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('landingSignInGithubBtn').addEventListener('click', async () => {
    const provider = new firebase.auth.GithubAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('landingSignInTwitterBtn').addEventListener('click', async () => {
    const provider = new firebase.auth.TwitterAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('authBtn').addEventListener('click', () => {
    auth.signOut();
});
async function switchTab(viewName, options = {}) {
    closeProfileDropdown();
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
    document.querySelectorAll('.nav-link-btn').forEach(b => b.classList.remove('active'));

    if (viewName === 'home') {
        document.getElementById('homeFeedView').classList.add('active-view');
        document.querySelectorAll('.nav-link-btn')[0].classList.add('active');
    } else if (viewName === 'messages') {
        document.getElementById('messagesView').classList.add('active-view');
        document.querySelectorAll('.nav-link-btn')[1].classList.add('active');

        const search = document.getElementById('dmUserSearch');
        if (search) search.value = '';
        dmSearchTerm = '';

        const requestedDmUid = options.dmUid || pendingDmUserId || activeDmUserId || null;
        pendingDmUserId = null;

        await renderDmFollowingUsers();

        if (requestedDmUid) {
            try {
                await openDmWithUser(requestedDmUid);
            } catch (err) {
                console.error('Could not open requested DM:', err);
                const stream = document.getElementById('dmMessagesStream');
                if (stream) stream.innerHTML = '<div class="dm-empty">Could not open this conversation. Please try again.</div>';
            }
        }
    } else if (viewName === 'notifications') {
        document.getElementById('notificationsView').classList.add('active-view');
        document.querySelectorAll('.nav-link-btn')[2].classList.add('active');
        renderNotifications();
    } else if (viewName === 'bookmarks') {
        document.getElementById('bookmarksView').classList.add('active-view');
        document.querySelectorAll('.nav-link-btn')[3].classList.add('active');
        renderBookmarks();
    } else if (viewName === 'profile') {
        document.getElementById('profileView').classList.add('active-view');
        document.querySelectorAll('.nav-link-btn')[4].classList.add('active');
        loadProfile(currentUser.uid);
    }
}

function switchFeedTab(tab) {
    currentFeedTab = tab;
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    
    const postComposer = document.getElementById('postComposerBox');
    const feedStream = document.getElementById('feedStream');
    const trendingStream = document.getElementById('trendingStream');

    if (tab === 'foryou') {
        document.getElementById('tabForYou').classList.add('active');
        postComposer.style.display = 'flex';
        feedStream.style.display = 'flex';
        trendingStream.style.display = 'none';
        renderFeed();
    } else if (tab === 'following') {
        document.getElementById('tabFollowing').classList.add('active');
        postComposer.style.display = 'flex';
        feedStream.style.display = 'flex';
        trendingStream.style.display = 'none';
        renderFeed();
    } else if (tab === 'trending') {
        document.getElementById('tabTrending').classList.add('active');
        postComposer.style.display = 'none';
        feedStream.style.display = 'none';
        trendingStream.style.display = 'flex';
    }
}

function togglePollComposer() {
    isPollActive = !isPollActive;
    const builder = document.getElementById('pollBuilder');
    builder.classList.toggle('active', isPollActive);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;
        let mediaType = 'image';
        if (file.type.startsWith('video/')) mediaType = 'video';
        if (file.type.startsWith('audio/')) mediaType = 'audio';

        selectedMediaData = {
            url: base64Data,
            type: mediaType
        };

        const previewContainer = document.getElementById('mediaPreviewContainer');
        const displayArea = document.getElementById('mediaPreviewDisplay');
        previewContainer.classList.add('active');

        if (mediaType === 'image') {
            displayArea.innerHTML = `<img src="${base64Data}" class="preview-media-element" alt="Preview">`;
        } else if (mediaType === 'video') {
            displayArea.innerHTML = `<video src="${base64Data}" class="preview-media-element" controls></video>`;
        } else if (mediaType === 'audio') {
            displayArea.innerHTML = `<audio src="${base64Data}" controls style="width:100%; margin-top:10px;"></audio>`;
        }
    };
    reader.readAsDataURL(file);
}

function clearSelectedMedia() {
    selectedMediaData = null;
    document.getElementById('localFileInput').value = '';
    document.getElementById('mediaPreviewContainer').classList.remove('active');
    document.getElementById('mediaPreviewDisplay').innerHTML = '';
}

function triggerPfpUpload() {
    if (currentProfileUserId === currentUser.uid) {
        document.getElementById('pfpFileInput').click();
    }
}

function handlePfpSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file for your profile picture.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Avatar = e.target.result;
        try {
            await db.collection('users').doc(currentUser.uid).update({
                photoURL: base64Avatar
            });
            currentUser.photoURL = base64Avatar;
            document.getElementById('userAvatarInput').src = base64Avatar;
            loadProfile(currentUser.uid);
            renderFeed();
        } catch (err) {
            alert('Error updating profile picture: ' + err.message);
        }
    };
    reader.readAsDataURL(file);
}

function initFollowingListener() {
    db.collection('users').doc(currentUser.uid).collection('following').onSnapshot(snapshot => {
        followingList = [];
        snapshot.forEach(doc => followingList.push(doc.id));
        if (currentFeedTab === 'following') {
            renderFeed();
        }
        if (document.getElementById('messagesView').classList.contains('active-view')) {
            renderDmFollowingUsers();
        }
    });
}

document.getElementById('submitPostBtn').addEventListener('click', async () => {
    const text = document.getElementById('postInputText').value.trim();
    if (!text && !selectedMediaData) return;

    let pollData = null;
    if (isPollActive) {
        const opt1 = document.getElementById('pollOpt1').value.trim();
        const opt2 = document.getElementById('pollOpt2').value.trim();
        const opt3 = document.getElementById('pollOpt3').value.trim();
        const opt4 = document.getElementById('pollOpt4').value.trim();

        if (opt1 && opt2) {
            const options = [opt1, opt2];
            if (opt3) options.push(opt3);
            if (opt4) options.push(opt4);

            pollData = {
                options: options.map(opt => ({ text: opt, votes: 0 })),
                totalVotes: 0,
                voters: {}
            };
        }
    }

    try {
        await db.collection('posts').add({
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            handle: currentUser.handle,
            userPhotoURL: currentUser.photoURL || null,
            text: text,
            mediaUrl: selectedMediaData ? selectedMediaData.url : null,
            mediaType: selectedMediaData ? selectedMediaData.type : null,
            poll: pollData,
            likesCount: 0,
            likedBy: [],
            repliesCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('postInputText').value = '';
        document.getElementById('pollOpt1').value = '';
        document.getElementById('pollOpt2').value = '';
        document.getElementById('pollOpt3').value = '';
        document.getElementById('pollOpt4').value = '';
        clearSelectedMedia();
        if (isPollActive) togglePollComposer();
    } catch (error) {
        alert('Error posting: ' + error.message);
    }
});

function initRealtimeFeed() {
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        allPosts = [];
        snapshot.forEach((doc) => {
            allPosts.push({ id: doc.id, ...doc.data() });
        });
        if (currentFeedTab !== 'trending') {
            renderFeed();
        }
    });
}

function renderFeed() {
    const feedStream = document.getElementById('feedStream');
    feedStream.innerHTML = '';

    let filteredPosts = allPosts;
    if (currentFeedTab === 'following') {
        filteredPosts = allPosts.filter(p => followingList.includes(p.uid) || p.uid === currentUser.uid);
    }

    if (filteredPosts.length === 0) {
        feedStream.innerHTML = '<div style="padding: 30px; text-align: center; color: #71767b;">No posts to display yet.</div>';
        return;
    }

    filteredPosts.forEach(post => {
        feedStream.appendChild(createPostCardElement(post));
    });
}

function createPostCardElement(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    const avatarUrl = post.userPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.handle}`;
    const isLiked = post.likedBy && post.likedBy.includes(currentUser.uid);
    const isBookmarked = bookmarks.includes(post.id);
    const timeAgo = post.createdAt ? formatTimeAgo(post.createdAt.toDate()) : 'Just now';

    let mediaHtml = '';
    if (post.mediaUrl) {
        const type = post.mediaType || 'image';
        if (type === 'image') {
            mediaHtml = `<img class="post-media" src="${escapeHtml(post.mediaUrl)}" alt="Post Media" onclick="event.stopPropagation(); openLightbox('${escapeHtml(post.mediaUrl)}')">`;
        } else if (type === 'video') {
            mediaHtml = `<video class="post-media" src="${escapeHtml(post.mediaUrl)}" controls onclick="event.stopPropagation()"></video>`;
        } else if (type === 'audio') {
            mediaHtml = `<audio class="post-media" src="${escapeHtml(post.mediaUrl)}" controls onclick="event.stopPropagation()"></audio>`;
        }
    }

    let pollHtml = '';
    if (post.poll && post.poll.options) {
        const totalVotes = post.poll.totalVotes || 0;
        const userVotedOption = post.poll.voters ? post.poll.voters[currentUser.uid] : undefined;

        pollHtml = `<div class="rendered-poll" onclick="event.stopPropagation()">`;
        post.poll.options.forEach((opt, idx) => {
            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
            pollHtml += `
                <div class="poll-option-btn" onclick="castPollVote('${post.id}', ${idx})">
                    <div class="poll-progress-fill" style="width: ${pct}%"></div>
                    <div class="poll-option-label">
                        <span>${escapeHtml(opt.text)} ${userVotedOption === idx ? '✓' : ''}</span>
                        <span>${pct}%</span>
                    </div>
                </div>
            `;
        });
        pollHtml += `<div class="poll-total-votes">${totalVotes} vote${totalVotes === 1 ? '' : 's'}</div></div>`;
    }

    card.innerHTML = `
        <img class="avatar" src="${escapeHtml(avatarUrl)}" alt="Avatar" onclick="event.stopPropagation(); openProfile('${post.uid}')">
        <div class="post-content-area">
            <div class="post-header-info">
                <span class="display-name" onclick="event.stopPropagation(); openProfile('${post.uid}')">${post.displayName}</span>
                <span class="handle">@${post.handle}</span>
                <span class="timestamp">· ${timeAgo}</span>
            </div>
            <div class="post-text">${escapeHtml(post.text || '')}</div>
            ${mediaHtml}
            ${pollHtml}
            <div class="post-footer-actions" onclick="event.stopPropagation()">
                <button class="action-btn" onclick="openThread('${post.id}')">
                    💬 <span>${post.repliesCount || 0}</span>
                </button>
                <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                    ❤️ <span>${post.likesCount || 0}</span>
                </button>
                <button class="action-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${post.id}')">
                    🔖
                </button>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openThread(post.id));
    return card;
}

async function castPollVote(postId, optionIdx) {
    const postRef = db.collection('posts').doc(postId);
    const doc = await postRef.get();
    if (!doc.exists) return;

    const post = doc.data();
    if (!post.poll) return;

    let poll = post.poll;
    if (!poll.voters) poll.voters = {};

    if (poll.voters[currentUser.uid] !== undefined) return;

    poll.voters[currentUser.uid] = optionIdx;
    poll.options[optionIdx].votes = (poll.options[optionIdx].votes || 0) + 1;
    poll.totalVotes = (poll.totalVotes || 0) + 1;

    await postRef.update({ poll: poll });
}

async function toggleLike(postId) {
    const postRef = db.collection('posts').doc(postId);
    const doc = await postRef.get();
    if (!doc.exists) return;

    const data = doc.data();
    let likedBy = data.likedBy || [];
    let likesCount = data.likesCount || 0;

    if (likedBy.includes(currentUser.uid)) {
        likedBy = likedBy.filter(id => id !== currentUser.uid);
        likesCount = Math.max(0, likesCount - 1);
    } else {
        likedBy.push(currentUser.uid);
        likesCount += 1;

        if (data.uid !== currentUser.uid) {
            sendNotification({
                recipientUid: data.uid,
                type: 'like',
                text: `${currentUser.displayName} liked your post.`,
                postId: postId
            });
        }
    }

    await postRef.update({ likedBy, likesCount });
}

function toggleBookmark(postId) {
    if (bookmarks.includes(postId)) {
        bookmarks = bookmarks.filter(id => id !== postId);
    } else {
        bookmarks.push(postId);
    }
    localStorage.setItem('trendit_bookmarks', JSON.stringify(bookmarks));
    renderFeed();
    if (document.getElementById('bookmarksView').classList.contains('active-view')) {
        renderBookmarks();
    }
}

function renderBookmarks() {
    const stream = document.getElementById('bookmarksStream');
    stream.innerHTML = '';
    const bookmarkedPosts = allPosts.filter(p => bookmarks.includes(p.id));

    if (bookmarkedPosts.length === 0) {
        stream.innerHTML = '<div style="padding: 30px; text-align: center; color: #71767b;">No bookmarks saved yet.</div>';
        return;
    }

    bookmarkedPosts.forEach(post => {
        stream.appendChild(createPostCardElement(post));
    });
}
function dmThreadId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

async function getFollowingUsers() {
    if (!currentUser) return [];
    const ids = followingList.filter(uid => uid && uid !== currentUser.uid);
    if (!ids.length) return [];
    const users = [];
    for (const uid of ids) {
        const snap = await db.collection('users').doc(uid).get();
        if (snap.exists) users.push({ uid: snap.id, ...snap.data() });
    }
    return users.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

async function searchUsersForDm(value) {
    if (!currentUser) return;
    const term = (value || '').trim().toLowerCase();
    dmSearchTerm = term;

    if (!term) {
        dmSearchResultsCache = [];
        await renderDmFollowingUsers();
        return;
    }

    const requestId = ++dmSearchRequestId;
    const list = document.getElementById('dmFollowingList');
    if (list) list.innerHTML = '<div class="dm-empty">Searching users...</div>';

    try {
        const snapshot = await db.collection('users').get();
        if (requestId !== dmSearchRequestId) return;

        dmSearchResultsCache = [];
        snapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const user = { uid: doc.id, ...doc.data() };
            const name = (user.displayName || '').toLowerCase();
            const handle = (user.handle || '').toLowerCase();
            if (name.includes(term) || handle.includes(term)) {
                dmSearchResultsCache.push(user);
            }
        });

        dmSearchResultsCache.sort((a, b) =>
            (a.displayName || '').localeCompare(b.displayName || '')
        );
        renderDmSearchResults();
    } catch (err) {
        console.error('User search failed:', err);
        if (list) list.innerHTML = '<div class="dm-empty">Could not search users. Please try again.</div>';
    }
}

async function getIncomingDmThreads() {
    if (!currentUser) return [];
    try {
        const snapshot = await db.collection('dmThreads')
            .where('participants', 'array-contains', currentUser.uid)
            .get();

        const threads = [];
        for (const doc of snapshot.docs) {
            const data = doc.data() || {};
            const otherUid = (data.participants || []).find(uid => uid !== currentUser.uid);
            if (!otherUid) continue;
            const userSnap = await db.collection('users').doc(otherUid).get();
            if (!userSnap.exists) continue;
            threads.push({
                threadId: doc.id,
                updatedAt: data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0,
                user: { uid: userSnap.id, ...userSnap.data() }
            });
        }
        threads.sort((a, b) => b.updatedAt - a.updatedAt);
        return threads;
    } catch (err) {
        console.error('Failed to load DM inbox:', err);
        return [];
    }
}

function createIncomingDmRow(entry) {
    const item = createDmUserRow(entry.user, false, false, true);
    item.classList.add('dm-inbox-item');
    return item;
}

async function renderDmFollowingUsers() {
    if (!currentUser) return;
    const list = document.getElementById('dmFollowingList');
    list.innerHTML = '<div class="dm-empty">Loading messages...</div>';
    try {
        dmUsersCache = await getFollowingUsers();
        dmSearchResultsCache = [];
        const inbox = await getIncomingDmThreads();

        list.innerHTML = '';

        if (inbox.length) {
            const inboxTitle = document.createElement('div');
            inboxTitle.className = 'dm-list-title';
            inboxTitle.textContent = 'Recent conversations';
            list.appendChild(inboxTitle);
            inbox.forEach(entry => list.appendChild(createIncomingDmRow(entry)));
        }

        const followTitle = document.createElement('div');
        followTitle.className = 'dm-list-title';
        followTitle.textContent = 'People you follow';
        list.appendChild(followTitle);

        if (dmUsersCache.length) {
            dmUsersCache.forEach(user => list.appendChild(createDmUserRow(user, true, false)));
        } else if (!inbox.length) {
            list.innerHTML = '<div class="dm-empty">You are not following anyone and have no messages yet.</div>';
        }
    } catch (err) {
        console.error('Failed to load DM inbox:', err);
        list.innerHTML = '<div class="dm-empty">Could not load your messages. Please try again.</div>';
    }
}

function filterDmUsers(value) {
    searchUsersForDm(value);
}

function createDmUserRow(user, isFollowed, showActions, allowIncoming = false) {
    const item = document.createElement('div');
    item.className = 'dm-convo-item' + (activeDmUserId === user.uid ? ' active' : '');

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = 'Avatar';
    avatar.onerror = function() { handleAvatarError(this); };
    avatar.src = DEFAULT_AVATAR_DATA_URI;
    resolveAvatarUrl(user, user.uid).then(url => {
        if (url) avatar.src = url;
    }).catch(() => handleAvatarError(avatar));

    const meta = document.createElement('div');
    meta.className = 'dm-user-meta';
    const name = document.createElement('strong');
    name.style.cssText = 'color:#fff;font-size:14px;';
    name.textContent = user.displayName || 'User';
    const handle = document.createElement('div');
    handle.style.cssText = 'font-size:12px;color:#71767b;';
    handle.textContent = '@' + (user.handle || 'user');
    meta.appendChild(name);
    meta.appendChild(handle);
    item.appendChild(avatar);
    item.appendChild(meta);

    if (showActions) {
        const actions = document.createElement('div');
        actions.className = 'dm-result-actions';

        if (isFollowed) {
            const dmBtn = document.createElement('button');
            dmBtn.className = 'dm-result-action';
            dmBtn.textContent = '💬';
            dmBtn.title = 'Message';
            dmBtn.addEventListener('click', async e => {
                e.stopPropagation();
                if (!(await isUserFollowed(user.uid))) {
                    alert('You can only message someone you follow.');
                    await searchUsersForDm(document.getElementById('dmUserSearch')?.value || '');
                    return;
                }
                await openDmWithUser(user.uid);
            });

            const callBtn = document.createElement('button');
            callBtn.className = 'dm-result-action';
            callBtn.textContent = '📞';
            callBtn.title = 'Call';
            callBtn.addEventListener('click', async e => {
                e.stopPropagation();
                if (!(await isUserFollowed(user.uid))) {
                    alert('You can only call someone you follow.');
                    await searchUsersForDm(document.getElementById('dmUserSearch')?.value || '');
                    return;
                }
                activeDmUserId = user.uid;
                await startCall('audio');
            });

            actions.appendChild(dmBtn);
            actions.appendChild(callBtn);
        } else {
            const followBtn = document.createElement('button');
            followBtn.className = 'dm-result-action dm-result-follow';
            followBtn.textContent = '+';
            followBtn.title = 'Follow to DM or call';
            followBtn.addEventListener('click', async e => {
                e.stopPropagation();
                try {
                    await followUserByUid(user.uid);
                    await searchUsersForDm(document.getElementById('dmUserSearch')?.value || '');
                } catch (err) {
                    console.error('Search follow error:', err);
                    alert('Could not follow this user. Please try again.');
                }
            });
            actions.appendChild(followBtn);
        }
        item.appendChild(actions);
    } else {
        item.addEventListener('click', () => openDmWithUser(user.uid, { allowIncoming }));
    }

    return item;
}

function renderFilteredDmUsers() {
    const list = document.getElementById('dmFollowingList');
    if (!list) return;
    const users = dmUsersCache.filter(user => {
        if (!dmSearchTerm) return true;
        return (user.displayName || '').toLowerCase().includes(dmSearchTerm) ||
               (user.handle || '').toLowerCase().includes(dmSearchTerm);
    });
    list.innerHTML = '';
    if (!users.length) {
        list.innerHTML = `<div class="dm-empty">${dmSearchTerm ? 'No matching users.' : 'You are not following anyone yet.'}</div>`;
        return;
    }
    users.forEach(user => list.appendChild(createDmUserRow(user, true, false)));
}

function renderDmSearchResults() {
    const list = document.getElementById('dmFollowingList');
    if (!list) return;
    list.innerHTML = '';
    if (!dmSearchResultsCache.length) {
        list.innerHTML = '<div class="dm-empty">No users found.</div>';
        return;
    }
    dmSearchResultsCache.forEach(user => {
        const isFollowed = followingList.includes(user.uid);
        list.appendChild(createDmUserRow(user, isFollowed, true));
    });
}

async function isUserFollowed(uid) {
    if (!currentUser || !uid || uid === currentUser.uid) return false;
    if (followingList.includes(uid)) return true;
    const snap = await db.collection('users').doc(currentUser.uid).collection('following').doc(uid).get();
    return snap.exists;
}

async function openDmWithUser(uid, options = {}) {
    if (!currentUser || !uid || uid === currentUser.uid) return;
    const isFollowed = await isUserFollowed(uid);
    if (!isFollowed && !options.allowIncoming) {
        alert('You can only start a direct message with someone you follow.');
        return;
    }
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return;
    const user = { uid: userSnap.id, ...userSnap.data() };
    activeDmUserId = uid;
    activeDmThreadId = dmThreadId(currentUser.uid, uid);

    const avatarUrl = await resolveAvatarUrl(user, uid);
    document.getElementById('activeDmAvatar').innerHTML = `<img class="avatar" src="${escapeHtml(avatarUrl || DEFAULT_AVATAR_DATA_URI)}" alt="Avatar" onerror="handleAvatarError(this)">`;
    document.getElementById('activeDmTitle').textContent = user.displayName || 'User';
    document.getElementById('activeDmHandle').textContent = '@' + (user.handle || 'user');
    
    document.getElementById('dmCallActions').style.display = isFollowed ? 'flex' : 'none';
    document.getElementById('dmInput').disabled = !isFollowed;
    document.getElementById('dmSendBtn').disabled = !isFollowed;
    document.getElementById('dmInput').placeholder = isFollowed ? 'Write a message...' : 'Follow this user to reply';
    renderFilteredDmUsers();
    subscribeToDmMessages();
}

function formatCallDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatCallHistoryTime(value) {
    if (!value) return '';
    try {
        const date = value.toDate ? value.toDate() : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

function renderCallHistoryItem(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-call-history';
    const isVideo = msg.callType === 'video';
    const accepted = msg.callStatus === 'accepted';
    const statusText = accepted ? 'Accepted' : 'Declined';
    const icon = isVideo ? '🎥' : '📞';
    const duration = accepted ? formatCallDuration(msg.durationSec) : '0:00';
    const direction = msg.callerUid === currentUser.uid ? 'Outgoing' : 'Incoming';
    wrap.innerHTML = `
        <div class="dm-call-history-icon">${icon}</div>
        <div class="dm-call-history-main">
            <div class="dm-call-history-title">${isVideo ? 'Video call' : 'Audio call'} · ${statusText}</div>
            <div class="dm-call-history-meta">${direction} · Duration ${duration}</div>
        </div>
        <div class="dm-call-history-time">${formatCallHistoryTime(msg.createdAt)}</div>
    `;
    return wrap;
}

function subscribeToDmMessages() {
    if (unsubscribeDmMessages) unsubscribeDmMessages();
    const stream = document.getElementById('dmMessagesStream');
    stream.innerHTML = '<div class="dm-empty">Loading messages...</div>';
    if (!activeDmThreadId) return;
    unsubscribeDmMessages = db.collection('dmThreads').doc(activeDmThreadId).collection('messages')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            stream.innerHTML = '';
            if (snapshot.empty) {
                stream.innerHTML = '<div class="dm-empty">No messages yet. Say hello 👋</div>';
                return;
            }
            snapshot.forEach(doc => {
                const msg = doc.data();
                if (msg.type === 'call') {
                    stream.appendChild(renderCallHistoryItem(msg));
                    return;
                }
                const bubble = document.createElement('div');
                bubble.className = 'dm-bubble ' + (msg.senderUid === currentUser.uid ? 'outgoing' : 'incoming');
                bubble.textContent = msg.text || '';
                stream.appendChild(bubble);
            });
            stream.scrollTop = stream.scrollHeight;
        }, error => {
            console.error('DM listener error:', error);
            stream.innerHTML = '<div class="dm-empty">Unable to load messages.</div>';
        });
}

async function sendDirectMessage() {
    const input = document.getElementById('dmInput');
    const text = input.value.trim();
    if (!text || !activeDmUserId || !activeDmThreadId || !currentUser) return;
    if (!(await isUserFollowed(activeDmUserId))) {
        alert('You can only message someone you currently follow.');
        return;
    }
    try {
        const threadRef = db.collection('dmThreads').doc(activeDmThreadId);
        await threadRef.set({
            participants: [currentUser.uid, activeDmUserId],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await threadRef.collection('messages').add({
            senderUid: currentUser.uid,
            recipientUid: activeDmUserId,
            text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
    } catch (err) {
        alert('Error sending message: ' + err.message);
    }
}

function handleDmKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendDirectMessage();
    }
}
function stopIncomingRingtone() {
    const nativePush = window.Capacitor?.Plugins?.NativePush;
    nativePush?.stopIncomingCallAlert?.().catch?.(() => {});
    if (ringtoneTimer) { clearInterval(ringtoneTimer); ringtoneTimer = null; }
}

async function startIncomingRingtone(callerName = 'Trendit user') {
    const nativePush = window.Capacitor?.Plugins?.NativePush;
    nativePush?.startIncomingCallAlert?.({ callerName }).catch?.(() => {});
}

async function writeCallHistoryEntry(callData, callStatus, durationSec) {
    if (!currentUser || !callData || !callData.callerUid || !callData.calleeUid) return;
    if (currentUser.uid !== callData.callerUid || callHistoryWritten) return;
    if (callStatus !== 'accepted' && callStatus !== 'declined') return;
    if (!activeDmThreadId) activeDmThreadId = dmThreadId(callData.callerUid, callData.calleeUid);

    callHistoryWritten = true;
    const historyRef = db.collection('dmThreads').doc(activeDmThreadId)
        .collection('messages').doc('call_' + (activeCallDocId || callData.callId || Date.now()));
    try {
        await historyRef.set({
            type: 'call',
            senderUid: callData.callerUid,
            recipientUid: callData.calleeUid,
            callerUid: callData.callerUid,
            calleeUid: callData.calleeUid,
            callType: callData.type || 'audio',
            callStatus,
            durationSec: Math.max(0, Math.round(durationSec || 0)),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        callHistoryWritten = false;
        console.error('Call history write failed:', err);
    }
}

function makeAgoraChannelName() {
    return `trendit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function showCallModal(title, status, type, incoming = false) {
    const modal = document.getElementById('callModal');
    const titleEl = document.getElementById('callTitle');
    const statusEl = document.getElementById('callStatus');
    const videoGrid = document.getElementById('callVideoGrid');
    const audioAvatar = document.getElementById('callAudioAvatar');
    const outgoingActions = document.getElementById('outgoingCallActions');
    const incomingActions = document.getElementById('incomingCallActions');

    if (titleEl) titleEl.textContent = title;
    if (statusEl) statusEl.textContent = status;
    if (videoGrid) videoGrid.style.display = 'block';
    if (audioAvatar) audioAvatar.style.display = type === 'video' ? 'none' : 'flex';
    if (outgoingActions) outgoingActions.style.display = incoming ? 'none' : 'flex';
    if (incomingActions) incomingActions.style.display = incoming ? 'flex' : 'none';
    if (modal) modal.classList.add('active');
}

function resetCallMediaUI() {
    const localVideo = document.getElementById('localCallVideo');
    const remoteVideo = document.getElementById('remoteCallVideo');
    const remoteAudio = document.getElementById('remoteCallAudio');
    if (localVideo) { localVideo.srcObject = null; localVideo.style.display = 'none'; }
    if (remoteVideo) { remoteVideo.srcObject = null; remoteVideo.style.display = 'none'; }
    if (remoteAudio) remoteAudio.srcObject = null;
    document.querySelectorAll('[id^="agora-remote-video-"]').forEach(el => el.remove());
    const audioAvatar = document.getElementById('callAudioAvatar');
    if (audioAvatar) audioAvatar.style.display = 'none';
}

function ensureAgoraClient() {
    if (agoraClient) return agoraClient;
    if (!window.AgoraRTC) throw new Error('Agora RTC SDK did not load. Check your internet connection.');

    agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    agoraClient.on('user-published', async (user, mediaType) => {
        try {
            await agoraClient.subscribe(user, mediaType);
            agoraRemoteUsers.set(String(user.uid), user);

            if (mediaType === 'video' && user.videoTrack) {
                const remoteUsers = Array.from(agoraRemoteUsers.values());
                let container;
                if (remoteUsers.length === 1) {
                    container = document.getElementById('remoteCallVideo');
                    if (container) container.style.display = 'block';
                } else {
                    const containerId = `agora-remote-video-${String(user.uid).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                    container = document.getElementById(containerId);
                    if (!container) {
                        const grid = document.getElementById('callVideoGrid');
                        container = document.createElement('div');
                        container.id = containerId;
                        container.className = 'call-video agora-remote-video-container';
                        grid.appendChild(container);
                    }
                }
                user.videoTrack.play(container);
            }

            if (mediaType === 'audio' && user.audioTrack) {
                user.audioTrack.play();
            }

            const status = document.getElementById('callStatus');
            if (status) status.textContent = 'Connected';
        } catch (err) {
            console.error('[Trendit Agora] subscribe failed:', err);
            const status = document.getElementById('callStatus');
            if (status) status.textContent = 'Could not receive remote media';
        }
    });

    agoraClient.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'video') {
            const id = `agora-remote-video-${String(user.uid).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const el = document.getElementById(id);
            if (el) el.remove();
            const remoteVideo = document.getElementById('remoteCallVideo');
            if (remoteVideo) { remoteVideo.style.display = 'none'; remoteVideo.srcObject = null; }
        }
    });

    agoraClient.on('user-left', user => {
        const id = `agora-remote-video-${String(user.uid).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const el = document.getElementById(id);
        if (el) el.remove();
        agoraRemoteUsers.delete(String(user.uid));
        if (agoraRemoteUsers.size === 0) {
            const remoteVideo = document.getElementById('remoteCallVideo');
            if (remoteVideo) { remoteVideo.style.display = 'none'; remoteVideo.srcObject = null; }
        }
    });

    agoraClient.on('connection-state-change', (curState, prevState, reason) => {
        console.log('[Trendit Agora] connection:', prevState, '->', curState, reason || '');
        const status = document.getElementById('callStatus');
        if (!status) return;
        if (curState === 'CONNECTED') status.textContent = 'Connected';
        else if (curState === 'CONNECTING' || curState === 'RECONNECTING') status.textContent = 'Connecting...';
        else if (curState === 'DISCONNECTED') status.textContent = 'Call disconnected';
    });

    return agoraClient;
}

function getAgoraUid() {
    if (!currentUser || !currentUser.uid) {
        throw new Error('You must be signed in before starting a call.');
    }
    let hash = 2166136261;
    const value = String(currentUser.uid);
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    hash = hash >>> 0;
    return (hash % 2147483646) + 1;
}

async function getAgoraToken(channel, uid) {
    try {
        const response = await fetch('/.netlify/functions/agora-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName: channel, uid })
        });
        const data = await response.json();
        if (data && data.token) return data.token;
    } catch (_) {}
    return null;
}

async function joinAgoraCall(channel, type) {
    if (!channel) throw new Error('No Agora channel was supplied for this call.');
    const client = ensureAgoraClient();
    const uid = getAgoraUid();
    const token = await getAgoraToken(channel, uid);

    agoraJoinedChannel = channel;
    await client.join(TRENDIt_AGORA_APP_ID, channel, token || null, uid);

    agoraLocalAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    agoraLocalVideoTrack = type === 'video' ? await AgoraRTC.createCameraVideoTrack() : null;

    if (type === 'video' && agoraLocalVideoTrack) {
        const localPreview = document.getElementById('localCallVideo');
        if (localPreview) localPreview.style.display = 'block';
        agoraLocalVideoTrack.play('localCallVideo');
    }

    const tracks = [agoraLocalAudioTrack];
    if (agoraLocalVideoTrack) tracks.push(agoraLocalVideoTrack);
    await client.publish(tracks);

    return client;
}

async function leaveAgoraCall() {
    const tracks = [agoraLocalAudioTrack, agoraLocalVideoTrack].filter(Boolean);
    for (const track of tracks) {
        try { track.stop(); } catch (_) {}
        try { track.close(); } catch (_) {}
    }
    agoraLocalAudioTrack = null;
    agoraLocalVideoTrack = null;
    agoraRemoteUsers.clear();

    if (agoraClient && agoraJoinedChannel) {
        try {
            await agoraClient.leave();
        } catch (err) {
            console.warn('[Trendit Agora] leave failed:', err);
        }
    }
    agoraJoinedChannel = null;
    resetCallMediaUI();
}

async function startCall(type) {
    if (activeIncomingCallId) {
        alert('You already have an incoming call. Accept or decline it first.');
        return;
    }
    if (!activeDmUserId || !currentUser) {
        alert('Select a person you follow before starting a call.');
        return;
    }
    if (!(await isUserFollowed(activeDmUserId))) {
        alert('Calls are only available with people you follow.');
        return;
    }

    try {
        await endCall(true);
        activeCallType = type;
        callConnectedAtMs = null;
        callHistoryWritten = false;
        activeDmThreadId = dmThreadId(currentUser.uid, activeDmUserId);
        await db.collection('dmThreads').doc(activeDmThreadId).set({
            participants: [currentUser.uid, activeDmUserId],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        activeCallDocId = `${activeDmThreadId}_${Date.now()}`;
        const channel = makeAgoraChannelName();
        const callRef = db.collection('calls').doc(activeCallDocId);

        await callRef.set({
            callerUid: currentUser.uid,
            calleeUid: activeDmUserId,
            type,
            channel,
            status: 'ringing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showCallModal(`${type === 'video' ? 'Video' : 'Audio'} call`, 'Calling...', type, false);

        unsubscribeCallDoc = callRef.onSnapshot(async snap => {
            const data = snap.data();
            if (!data) return;
            if (data.status === 'declined' || data.status === 'ended') {
                document.getElementById('callStatus').textContent = data.status === 'declined' ? 'Call declined' : 'Call ended';
                setTimeout(() => endCall(true), 250);
                return;
            }
            if (data.status === 'accepted' && !callConnectedAtMs) {
                callConnectedAtMs = Date.now();
                document.getElementById('callStatus').textContent = 'Connected';
            }
        });

        await joinAgoraCall(channel, type);
    } catch (err) {
        console.error('Start call error:', err);
        await endCall(true);
        alert('Could not start call: ' + (err.message || err));
    }
}

function initIncomingCallListener() {
    if (!currentUser) return;
    if (unsubscribeIncomingCalls) unsubscribeIncomingCalls();

    unsubscribeIncomingCalls = db.collection('calls')
        .where('calleeUid', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type !== 'added' && change.type !== 'modified') return;
                if (activeCallDocId || activeIncomingCallId) return;
                const data = change.doc.data();
                if (!data || data.status !== 'ringing' || data.callerUid === currentUser.uid || !data.channel) return;
                activeIncomingCallId = change.doc.id;
                handleIncomingCall(change.doc.id, data).catch(err => {
                    console.error('Incoming call error:', err);
                    activeIncomingCallId = null;
                });
            });
        });
}

async function handleIncomingCall(callId, data) {
    if (!currentUser || !callId || !data || !data.channel) return;
    activeCallDocId = callId;
    activeCallType = data.type || 'audio';
    activeDmUserId = data.callerUid;
    activeDmThreadId = dmThreadId(data.callerUid, data.calleeUid);
    callConnectedAtMs = null;
    callHistoryWritten = false;
    showCallModal(`${activeCallType === 'video' ? 'Video' : 'Audio'} call`, 'Incoming call...', activeCallType, true);
    startIncomingRingtone();
}

async function acceptIncomingCall() {
    if (!activeIncomingCallId || !currentUser) return;
    const callId = activeIncomingCallId;
    const callRef = db.collection('calls').doc(callId);

    try {
        stopIncomingRingtone();
        const snap = await callRef.get();
        const data = snap.data();
        if (!data || data.status !== 'ringing' || !data.channel) throw new Error('This call is no longer available.');

        activeCallDocId = callId;
        activeCallType = data.type || 'audio';
        activeDmUserId = data.callerUid;
        activeDmThreadId = dmThreadId(data.callerUid, data.calleeUid);

        await joinAgoraCall(data.channel, activeCallType);

        await callRef.update({
            status: 'accepted',
            acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('incomingCallActions').style.display = 'none';
        document.getElementById('outgoingCallActions').style.display = 'flex';
        callConnectedAtMs = Date.now();
        document.getElementById('callStatus').textContent = 'Connected';
        activeIncomingCallId = null;
    } catch (err) {
        console.error('Accept call error:', err);
        alert('Could not answer call: ' + (err.message || err));
        await endCall(true);
    }
}

async function declineIncomingCall(silent = false) {
    stopIncomingRingtone();
    const callId = activeIncomingCallId || activeCallDocId;
    if (callId) {
        try {
            await db.collection('calls').doc(callId).update({
                status: 'declined',
                endedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (_) {}
    }
    activeIncomingCallId = null;
    if (!silent) await endCall(true);
}

async function endCall(silent = false) {
    const callId = activeCallDocId;
    stopIncomingRingtone();
    if (unsubscribeCallDoc) { unsubscribeCallDoc(); unsubscribeCallDoc = null; }

    try {
        if (callId) {
            const callRef = db.collection('calls').doc(callId);
            const snap = await callRef.get();
            if (snap.exists) {
                const callData = snap.data();
                await callRef.update({
                    status: 'ended',
                    endedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (currentUser && callData.callerUid === currentUser.uid) {
                    let durationSec = 0;
                    if (callConnectedAtMs) {
                        durationSec = Math.max(0, Math.round((Date.now() - callConnectedAtMs) / 1000));
                    }
                    await writeCallHistoryEntry(callData, 'accepted', durationSec);
                }
            }
        }
    } catch (_) {}

    await leaveAgoraCall();
    activeCallDocId = null;
    activeIncomingCallId = null;
    callConnectedAtMs = null;
    callHistoryWritten = false;
    document.getElementById('callModal').classList.remove('active');
    resetCallMediaUI();
}

async function openThread(postId) {
    activeThreadPostId = postId;
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
    document.getElementById('threadView').classList.add('active-view');
    const doc = await db.collection('posts').doc(postId).get();
    if (!doc.exists) return;
    const post = { id: doc.id, ...doc.data() };

    const container = document.getElementById('activePostContainer');
    container.innerHTML = '';
    container.appendChild(createPostCardElement(post));

    if (unsubscribeReplies) unsubscribeReplies();
    unsubscribeReplies = db.collection('posts').doc(postId).collection('replies')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            const repliesStream = document.getElementById('repliesStream');
            repliesStream.innerHTML = '';
            snapshot.forEach(replyDoc => {
                const reply = replyDoc.data();
                const replyEl = document.createElement('div');
                replyEl.className = 'post-card';
                const avatarUrl = reply.userPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.handle}`;
                replyEl.innerHTML = `
                    <img class="avatar" src="${avatarUrl}" alt="Avatar" onclick="event.stopPropagation(); openProfile('${reply.uid}')">
                    <div class="post-content-area">
                        <div class="post-header-info">
                            <span class="display-name" onclick="event.stopPropagation(); openProfile('${reply.uid}')">${reply.displayName}</span>
                            <span class="handle">@${reply.handle}</span>
                        </div>
                        <div class="post-text">${escapeHtml(reply.text)}</div>
                    </div>
                `;
                repliesStream.appendChild(replyEl);
            });
        });
}

document.getElementById('backToHomeBtn').addEventListener('click', () => {
    if (unsubscribeReplies) unsubscribeReplies();
    switchTab('home');
});

document.getElementById('submitReplyBtn').addEventListener('click', async () => {
    const text = document.getElementById('replyInputText').value.trim();
    if (!text || !activeThreadPostId) return;

    try {
        const batch = db.batch();
        const replyRef = db.collection('posts').doc(activeThreadPostId).collection('replies').doc();
        batch.set(replyRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            handle: currentUser.handle,
            userPhotoURL: currentUser.photoURL || null,
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const postRef = db.collection('posts').doc(activeThreadPostId);
        batch.update(postRef, {
            repliesCount: firebase.firestore.FieldValue.increment(1)
        });

        await batch.commit();

        const postDoc = await postRef.get();
        if (postDoc.exists && postDoc.data().uid !== currentUser.uid) {
            sendNotification({
                recipientUid: postDoc.data().uid,
                type: 'reply',
                text: `${currentUser.displayName} replied to your post.`,
                postId: activeThreadPostId
            });
        }

        document.getElementById('replyInputText').value = '';
    } catch (error) {
        alert('Error sending reply: ' + error.message);
    }
});

async function sendNotification({ recipientUid, type, text, postId }) {
    try {
        await db.collection('notifications').add({
            recipientUid: recipientUid,
            senderUid: currentUser.uid,
            senderHandle: currentUser.handle,
            type: type,
            text: text,
            postId: postId || null,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error("Failed to push notification:", err);
    }
}

function initRealtimeNotifications() {
    db.collection('notifications')
        .where('recipientUid', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            let unreadCount = 0;
            snapshot.forEach(doc => {
                if (!doc.data().read) unreadCount++;
            });

            const badge = document.getElementById('notifBadge');
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        });
}

async function renderNotifications() {
    const stream = document.getElementById('notificationsStream');
    stream.innerHTML = '';

    const snapshot = await db.collection('notifications')
        .where('recipientUid', '==', currentUser.uid)
        .get();

    if (snapshot.empty) {
        stream.innerHTML = '<div style="padding: 30px; text-align: center; color: #71767b;">No notifications yet.</div>';
        return;
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    const batch = db.batch();

    docs.forEach(notif => {
        const card = document.createElement('div');
        card.className = `notification-card ${!notif.read ? 'unread' : ''}`;
        
        let icon = '🔔';
        if (notif.type === 'like') icon = '❤️';
        if (notif.type === 'reply') icon = '💬';
        if (notif.type === 'follow') icon = '👤';
        card.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-text">${escapeHtml(notif.text)}</div>
            </div>
        `;

        if (notif.postId) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => openThread(notif.postId));
        }

        stream.appendChild(card);

        if (!notif.read) {
            const ref = db.collection('notifications').doc(notif.id);
            batch.update(ref, { read: true });
        }
    });

    await batch.commit();
}

async function openProfile(uid) {
    if (!uid || !currentUser) return;
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
    document.getElementById('profileView').classList.add('active-view');
    document.querySelectorAll('.nav-link-btn').forEach(b => b.classList.remove('active'));
    const profileBtn = document.getElementById('profileNavBtn');
    if (profileBtn) profileBtn.classList.add('active');
    await loadProfile(String(uid).trim());
}

async function loadProfile(uid) {
    if (!currentUser || !uid) return;
    const targetUid = String(uid).trim();
    currentProfileUserId = targetUid;

    const profileAvatar = document.getElementById('profileViewAvatar');
    const followBtn = document.getElementById('profileFollowBtn');
    const contactActions = document.getElementById('profileContactActions');
    const editBtn = document.getElementById('editProfileBtn');
    const pfpOverlay = document.getElementById('pfpOverlay');

    handleAvatarError(profileAvatar);

    try {
        const userDoc = await db.collection('users').doc(targetUid).get();
        if (!userDoc.exists) return;

        const userData = { uid: userDoc.id, ...userDoc.data() };

        document.getElementById('profileViewName').textContent = userData.displayName || 'User';
        document.getElementById('profileViewHandle').textContent = '@' + (userData.handle || 'user');
        document.getElementById('profileViewBio').textContent = userData.bio || '';
        document.getElementById('profileViewAge').textContent = `Age: ${userData.age || 'N/A'}`;
        document.getElementById('profileViewGender').textContent = `Gender: ${userData.gender || 'N/A'}`;

        await setAvatarImage(profileAvatar, userData, targetUid);

        const [followingSnap, followersSnap] = await Promise.all([
            db.collection('users').doc(targetUid).collection('following').get(),
            db.collection('users').doc(targetUid).collection('followers').get()
        ]);
        document.getElementById('profileFollowingCount').textContent = followingSnap.size;
        document.getElementById('profileFollowersCount').textContent = followersSnap.size;

        if (targetUid === currentUser.uid) {
            if (editBtn) editBtn.style.display = 'inline-block';
            if (followBtn) followBtn.style.display = 'none';
            if (contactActions) contactActions.style.display = 'none';
            if (pfpOverlay) pfpOverlay.style.display = 'flex';
        } else {
            if (editBtn) editBtn.style.display = 'none';
            if (pfpOverlay) pfpOverlay.style.display = 'none';

            const followingDoc = await db.collection('users').doc(currentUser.uid)
                .collection('following').doc(targetUid).get();
            const isFollowing = followingDoc.exists;

            if (followBtn) {
                followBtn.disabled = false;
                followBtn.textContent = '+';
                followBtn.style.display = isFollowing ? 'none' : 'flex';
            }
            if (contactActions) contactActions.style.display = isFollowing ? 'flex' : 'none';
        }

        const userPostsStream = document.getElementById('userPostsStream');
        userPostsStream.innerHTML = '';
        const userPosts = allPosts.filter(p => p.uid === targetUid);
        if (!userPosts.length) {
            userPostsStream.innerHTML = '<div style="padding:30px;text-align:center;color:#71767b;">No posts from this user yet.</div>';
        } else {
            userPosts.forEach(post => userPostsStream.appendChild(createPostCardElement(post)));
        }
    } catch (error) {
        console.error('Profile loading error:', error);
    }
}

async function followUserByUid(targetUid) {
    if (!currentUser || !targetUid || targetUid === currentUser.uid) return;

    const myFollowingRef = db.collection('users').doc(currentUser.uid)
        .collection('following').doc(targetUid);
    const targetFollowerRef = db.collection('users').doc(targetUid)
        .collection('followers').doc(currentUser.uid);

    const existing = await myFollowingRef.get();
    if (existing.exists) return;

    const batch = db.batch();
    batch.set(myFollowingRef, {
        uid: targetUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.set(targetFollowerRef, {
        uid: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();

    if (!followingList.includes(targetUid)) followingList.push(targetUid);

    try {
        await sendNotification({
            recipientUid: targetUid,
            type: 'follow',
            text: `${currentUser.displayName} started following you.`
        });
    } catch (_) {}
}

async function messageCurrentProfile() {
    if (!currentUser || !currentProfileUserId || currentProfileUserId === currentUser.uid) return;
    const targetUid = String(currentProfileUserId).trim();

    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
    document.querySelectorAll('.nav-link-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('messagesView').classList.add('active-view');
    const messagesNav = document.querySelectorAll('.nav-link-btn')[1];
    if (messagesNav) messagesNav.classList.add('active');

    await openDmWithUser(targetUid);
}

async function callCurrentProfile() {
    if (!currentUser || !currentProfileUserId || currentProfileUserId === currentUser.uid) return;
    activeDmUserId = currentProfileUserId;
    await startCall('audio');
}

async function toggleFollowCurrentProfile() {
    if (!currentUser || !currentProfileUserId || currentProfileUserId === currentUser.uid) return;
    const targetUid = currentProfileUserId;
    await followUserByUid(targetUid);
    await loadProfile(targetUid);
}

async function promptEditBio() {
    const newBio = prompt('Enter your new bio:', currentUser.bio || '');
    if (newBio !== null) {
        await db.collection('users').doc(currentUser.uid).update({ bio: newBio });
        currentUser.bio = newBio;
        loadProfile(currentUser.uid);
    }
}

function openLightbox(mediaUrl) {
    document.getElementById('lightboxImage').src = mediaUrl;
    document.getElementById('lightboxModal').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightboxModal').classList.remove('active');
    document.getElementById('lightboxImage').src = '';
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + 'y';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + 'mo';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + 'd';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm';
    return 'Just now';
}

function getAvatarSource(userData = {}, fallbackSeed = 'trendit') {
    const candidates = [
        userData.photoURL,
        userData.avatarUrl,
        userData.photoUrl,
        userData.avatar,
        userData.profilePicture,
        userData.profilePhoto
    ];
    return candidates.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}

async function resolveAvatarUrl(userData = {}, fallbackSeed = 'trendit') {
    const raw = getAvatarSource(userData, fallbackSeed);
    if (raw) {
        if (raw.startsWith('gs://')) {
            try {
                return await storage.refFromURL(raw).getDownloadURL();
            } catch (_) {}
        } else {
            return raw;
        }
    }

    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        userData.handle || userData.uid || userData.displayName || fallbackSeed
    )}`;
}

async function setAvatarImage(img, userData = {}, fallbackSeed = 'trendit') {
    if (!img) return;
    img.alt = 'Avatar';
    img.onerror = () => handleAvatarError(img);
    img.src = DEFAULT_AVATAR_DATA_URI;

    try {
        const url = await resolveAvatarUrl(userData, fallbackSeed);
        if (url) img.src = url;
    } catch (_) {
        handleAvatarError(img);
    }
}

function handleAvatarError(img) {
    if (!img) return;
    img.onerror = null;
    img.removeAttribute('srcset');
    img.src = DEFAULT_AVATAR_DATA_URI;
    img.style.backgroundImage = 'none';
    img.style.objectFit = 'cover';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// PWA Mobile In-App Installation Handlers
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwaInstallHeaderBtn');
    if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('pwaInstallHeaderBtn');
    if (btn) btn.style.display = 'none';
});

function promptPwaInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            const btn = document.getElementById('pwaInstallHeaderBtn');
            if (btn) btn.style.display = 'none';
        });
    } else {
        alert('To install Trendit on your Android phone:\n\n1. Tap the 3 dots (⋮) in your Chrome browser menu (top right).\n2. Tap "Install app" or "Add to Home screen".\n\nIt will install directly onto your home screen with its own app icon!');
    }
}

// Register Service Worker for PWA Android Installation
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Trendit PWA Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.warn('Trendit Service Worker registration failed:', error);
            });
    });
}
