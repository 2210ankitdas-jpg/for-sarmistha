import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion 
} from 'firebase/firestore';
import { 
  Heart, Sparkles, MessageCircle, Flame, Volume2, VolumeX, 
  X, Crown, Play, Plus, Zap, CheckCircle2, RotateCcw, 
  Copy, Share2, Users, RefreshCw, LogOut, Check
} from 'lucide-react';

// Setup Firebase Configuration
const firebaseConfig = (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null) || {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456:web:123456"
};
const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== "demo-key" && firebaseConfig.projectId !== "demo-project");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'velvet-vows-default';

// Preset Question Deck categorized by heat level
const QUESTION_DATABASE = {
  mild: [
    "What was the exact moment you realized you had deep feelings for me?",
    "What is one secret fantasy date night you’ve never told me about?",
    "If we could drop everything right now and fly anywhere for 48 hours, where are we going?",
    "What is your absolute favorite physical feature of mine when I get dressed up?",
    "What is one song that always makes you think of our intimacy?",
    "What is the fondest memory you have of our very first kiss?",
    "If you could describe our love in three words, what would they be?"
  ],
  spicy: [
    "Where is the riskiest place you’ve secretly wished we’d get intimate?",
    "Describe in vivid detail what I wear that turns you on the fastest.",
    "If you could control my actions for 10 minutes without saying no, what's your first command?",
    "What was your wildness rating when we first met vs. how I make you feel now?",
    "What's one touch or kiss technique of mine that drives you completely crazy?",
    "What's a subtle touch I do in public that secretly drives you wild?",
    "What outfit of mine would you want to take off right now?"
  ],
  steamy: [
    "What is the ultimate, unfiltered 18+ fantasy you want us to fulfill together tonight?",
    "Slowly whisper in my ear (or type here): What exact spot on your body wants my attention right now?",
    "If we played a roleplay scenario starting right after this question, who would you want us to be?",
    "Describe the most intense physical sensory moment we have ever shared together.",
    "What is one secret boundary you are secretly tempted to cross with me?",
    "What is the dirtiest thought you've had about me during an ordinary day?",
    "Describe step-by-step how you want our night to end after we close this app."
  ]
};

const DARES_DATABASE = [
  "Give your partner a 60-second lingering kiss on the back of their neck.",
  "Whisper your dirtiest secret into your partner's ear right now (or type it in live chat).",
  "Take off one item of clothing chosen by your partner.",
  "Maintain eye contact with your partner for 30 seconds while gently stroking their face.",
  "Give your partner a slow, gentle shoulder massage until the timer ticks down.",
  "Lick your lips while looking deeply into your partner's eyes for 15 seconds.",
  "Gently trace your lips along your partner's jawline without actually touching."
];

export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'Ankit' or 'Sarmistha'

  // Room state
  const [roomCode, setRoomCode] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState(hasFirebaseConfig ? '' : 'Multiplayer setup is pending: connect a Firebase project and add its configuration to GitHub Actions secrets.');

  // Synchronized Game State (From Firestore)
  const [gameState, setGameState] = useState({
    activeTurnRole: 'Ankit', // 'Ankit' or 'Sarmistha'
    heatLevel: 'spicy',
    currentQuestion: "Click 'Next Card' to reveal your first prompt...",
    scores: { Ankit: 0, Sarmistha: 0 },
    activeDare: null,
    messages: [],
    customDeck: { mild: [], spicy: [], steamy: [] },
    cardCount: 1
  });

  // Local UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customQ, setCustomQ] = useState("");
  const [customHeat, setCustomHeat] = useState("spicy");

  const chatEndRef = useRef(null);
  const prevMsgLengthRef = useRef(0);

  // 1. Authenticate user on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Listener for Room Data
  useEffect(() => {
    if (!user || !joinedRoom) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', joinedRoom);

    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGameState(data);

        // Track unread chat messages
        if (data.messages && data.messages.length > prevMsgLengthRef.current) {
          const newMsg = data.messages[data.messages.length - 1];
          if (newMsg.senderRole !== userRole && !isChatOpen) {
            setUnreadCount(prev => prev + (data.messages.length - prevMsgLengthRef.current));
          }
          prevMsgLengthRef.current = data.messages.length;
        }
      } else {
        setErrorMsg('Room closed or expired.');
        setJoinedRoom(null);
      }
    }, (err) => {
      console.error("Firestore listener error:", err);
    });

    return () => unsubscribe();
  }, [user, joinedRoom, userRole, isChatOpen]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [gameState.messages, isChatOpen]);

  // Audio synthesis helper
  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'card') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'flame') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(450, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.log('Audio not supported yet');
    }
  };

  // Generate 6-char Room Code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Create Room
  const handleCreateRoom = async (selectedRole) => {
    if (!user) return;
    const code = generateRoomCode();
    setUserRole(selectedRole);
    setErrorMsg('');

    const initialQuestion = getRandomQuestion('spicy', { mild: [], spicy: [], steamy: [] });

    const newRoomData = {
      createdAt: Date.now(),
      activeTurnRole: 'Ankit',
      heatLevel: 'spicy',
      currentQuestion: initialQuestion,
      scores: { Ankit: 0, Sarmistha: 0 },
      activeDare: null,
      messages: [
        {
          id: Date.now(),
          senderRole: 'System',
          text: `Welcome to Velvet & Vows! Room ${code} created. The intimate atmosphere is set... 🔥`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true
        }
      ],
      customDeck: { mild: [], spicy: [], steamy: [] },
      cardCount: 1,
      playersJoined: [selectedRole]
    };

    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      await setDoc(roomRef, newRoomData);
      setRoomCode(code);
      setJoinedRoom(code);
    } catch (e) {
      console.error("Error creating room:", e);
      setErrorMsg("Failed to create room. Please try again.");
    }
  };

  // Join Existing Room
  const handleJoinRoom = async (selectedRole) => {
    if (!user || !inputCode.trim()) return;
    const code = inputCode.trim().toUpperCase();
    setErrorMsg('');

    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      const docSnap = await getDoc(roomRef);

      if (!docSnap.exists()) {
        setErrorMsg('Room not found! Please check the code.');
        return;
      }

      setUserRole(selectedRole);
      setRoomCode(code);
      setJoinedRoom(code);

      // Announce player join in chat
      await updateDoc(roomRef, {
        messages: arrayUnion({
          id: Date.now(),
          senderRole: 'System',
          text: `${selectedRole} has connected to the intimate room ❤️`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true
        })
      });
    } catch (e) {
      console.error("Error joining room:", e);
      setErrorMsg("Could not join room.");
    }
  };

  // Get random question helper
  const getRandomQuestion = (level, customDeck) => {
    const defaultPool = QUESTION_DATABASE[level] || [];
    const customPool = customDeck[level] || [];
    const combinedPool = [...defaultPool, ...customPool];
    const randomIndex = Math.floor(Math.random() * combinedPool.length);
    return combinedPool[randomIndex] || "What is the most romantic thing I've ever done for you?";
  };

  // Sync turn progression to Firestore
  const handleNextTurn = async (answered = true) => {
    if (!joinedRoom || !user) return;
    playSound('card');

    const nextRole = gameState.activeTurnRole === 'Ankit' ? 'Sarmistha' : 'Ankit';
    const nextQ = getRandomQuestion(gameState.heatLevel, gameState.customDeck || { mild: [], spicy: [], steamy: [] });

    const updatedScores = { ...gameState.scores };
    if (answered) {
      updatedScores[gameState.activeTurnRole] = (updatedScores[gameState.activeTurnRole] || 0) + 10;
    }

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', joinedRoom);
    
    try {
      await updateDoc(roomRef, {
        activeTurnRole: nextRole,
        currentQuestion: nextQ,
        scores: updatedScores,
        activeDare: null,
        cardCount: (gameState.cardCount || 1) + 1
      });
    } catch (e) {
      console.error("Error updating turn:", e);
    }
  };

  // Sync Dare Trigger
  const handleTriggerDare = async () => {
    if (!joinedRoom || !user) return;
    playSound('flame');
    const randomDare = DARES_DATABASE[Math.floor(Math.random() * DARES_DATABASE.length)];
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', joinedRoom);

    try {
      await updateDoc(roomRef, {
        activeDare: randomDare,
        messages: arrayUnion({
          id: Date.now(),
          senderRole: 'System',
          text: `🔥 ${userRole} chose to take a Dare: "${randomDare}"`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true
        })
      });
    } catch (e) {
      console.error("Error setting dare:", e);
    }
  };

  // Sync Heat Level Change
  const handleChangeHeatLevel = async (newLevel) => {
    if (!joinedRoom || !user) return;
    const nextQ = getRandomQuestion(newLevel, gameState.customDeck || { mild: [], spicy: [], steamy: [] });
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', joinedRoom);

    try {
      await updateDoc(roomRef, {
        heatLevel: newLevel,
        currentQuestion: nextQ,
        activeDare: null
      });
    } catch (e) {
      console.error("Error changing heat level:", e);
    }
  };

  // Sync Live Chat Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !joinedRoom || !user) return;

    const msgObj = {
      id: Date.now(),
      senderRole: userRole,
      text: newMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: false
    };

    setNewMessage('');
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', joinedRoom);

    try {
      await updateDoc(roomRef, {
        messages: arrayUnion(msgObj)
      });
    } catch (e) {
      console.error("Error sending message:", e);
    }
  };

  // Sync Adding Custom Question
  const handleAddCustomQuestion = async (e) => {
    e.preventDefault();
    if (!customQ.trim() || !joinedRoom || !user) return;

    const updatedCustomDeck = {
      ...gameState.customDeck,
      [customHeat]: [...(gameState.customDeck?.[customHeat] || []), customQ.trim()]
    };

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', joinedRoom);

    try {
      await updateDoc(roomRef, {
        customDeck: updatedCustomDeck,
        messages: arrayUnion({
          id: Date.now(),
          senderRole: 'System',
          text: `🔥 ${userRole} secretly added a custom prompt to the ${customHeat.toUpperCase()} deck!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true
        })
      });
      setCustomQ('');
      setShowAddModal(false);
    } catch (e) {
      console.error("Error adding custom question:", e);
    }
  };

  // Copy Room Code / Link
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Exit Room
  const handleLeaveRoom = () => {
    setJoinedRoom(null);
    setRoomCode('');
    setUserRole(null);
  };

  // Screen 1: Welcome & Room Connect
  if (!joinedRoom) {
    return (
      <div className="min-h-screen bg-neutral-950 text-rose-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-900/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-600/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-md w-full bg-neutral-900/90 border border-rose-900/50 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl z-10 text-center">
          <div className="inline-flex p-3 bg-rose-950/80 border border-rose-800/40 rounded-2xl mb-4 text-rose-400">
            <Flame className="w-8 h-8 animate-pulse text-amber-500" />
          </div>
          
          <h1 className="text-3xl font-serif tracking-wide text-rose-100 mb-1">Velvet & Vows</h1>
          <p className="text-rose-300/70 text-xs mb-6 uppercase tracking-widest font-semibold">Real-Time Sensual Couples Game</p>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-950/80 border border-rose-600/50 text-rose-300 rounded-xl text-xs">
              {errorMsg}
            </div>
          )}

          <div className="space-y-6">
            {/* Create Room Section */}
            <div className="p-4 bg-neutral-950/60 border border-rose-900/40 rounded-2xl">
              <h2 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-3">Option 1: Start a New Room</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCreateRoom('Ankit')}
                  className="py-2.5 px-3 bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-rose-100 text-xs font-medium rounded-xl border border-rose-600/40 shadow-md transition active:scale-95 flex items-center justify-center gap-1"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Host as Ankit
                </button>
                <button
                  onClick={() => handleCreateRoom('Sarmistha')}
                  className="py-2.5 px-3 bg-gradient-to-r from-amber-700 to-rose-700 hover:from-amber-600 hover:to-rose-600 text-rose-100 text-xs font-medium rounded-xl border border-rose-600/40 shadow-md transition active:scale-95 flex items-center justify-center gap-1"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Host as Sarmistha
                </button>
              </div>
            </div>

            {/* Join Room Section */}
            <div className="p-4 bg-neutral-950/60 border border-rose-900/40 rounded-2xl">
              <h2 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-3">Option 2: Join Partner's Room</h2>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="ENTER 6-LETTER ROOM CODE"
                maxLength={6}
                className="w-full text-center bg-neutral-900 border border-rose-900/50 rounded-xl py-2.5 text-rose-100 text-sm tracking-widest placeholder-neutral-600 focus:outline-none focus:border-rose-500 mb-3"
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleJoinRoom('Ankit')}
                  disabled={!inputCode.trim()}
                  className="py-2.5 px-3 bg-neutral-900 hover:bg-rose-950 border border-rose-800/60 disabled:opacity-40 text-rose-200 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1"
                >
                  Join as Ankit
                </button>
                <button
                  onClick={() => handleJoinRoom('Sarmistha')}
                  disabled={!inputCode.trim()}
                  className="py-2.5 px-3 bg-neutral-900 hover:bg-amber-950 border border-rose-800/60 disabled:opacity-40 text-amber-200 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1"
                >
                  Join as Sarmistha
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Player Info
  const isMyTurn = gameState.activeTurnRole === userRole;

  return (
    <div className="min-h-screen bg-neutral-950 text-rose-50 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-rose-900 selection:text-white">
      {/* Dynamic Background Glows */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] blur-[140px] pointer-events-none transition-all duration-700 ${
        gameState.heatLevel === 'mild' ? 'bg-rose-900/20' : gameState.heatLevel === 'spicy' ? 'bg-rose-800/35' : 'bg-rose-600/40'
      }`} />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-700/15 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="px-4 py-3 sm:px-8 border-b border-rose-900/30 bg-neutral-950/80 backdrop-blur-md z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-900 to-neutral-900 border border-rose-700/50 flex items-center justify-center shadow-inner">
            <Flame className={`w-5 h-5 ${gameState.heatLevel === 'steamy' ? 'text-amber-400 animate-pulse' : 'text-rose-400'}`} />
          </div>
          <div>
            <h1 className="font-serif text-base sm:text-lg font-bold bg-gradient-to-r from-rose-100 via-rose-200 to-amber-200 bg-clip-text text-transparent">
              Velvet & Vows
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-rose-300/70 uppercase tracking-widest font-semibold">
                You: <span className="text-amber-400 font-bold">{userRole}</span>
              </span>
              <button 
                onClick={copyRoomCode}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800/50 text-[10px] text-rose-300 hover:text-white transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                ROOM: {roomCode}
              </button>
            </div>
          </div>
        </div>

        {/* Score & Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-3 bg-neutral-900/80 border border-rose-900/40 rounded-full px-4 py-1.5 text-xs text-rose-200">
            <span className={`font-semibold ${userRole === 'Ankit' ? 'text-amber-400' : 'text-rose-300'}`}>
              Ankit: {gameState.scores?.Ankit || 0} pts
            </span>
            <span className="text-neutral-600">|</span>
            <span className={`font-semibold ${userRole === 'Sarmistha' ? 'text-amber-400' : 'text-rose-300'}`}>
              Sarmistha: {gameState.scores?.Sarmistha || 0} pts
            </span>
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="p-2 rounded-full bg-rose-950/60 border border-rose-800/40 text-rose-300 hover:text-white hover:bg-rose-900/50 transition"
            title="Add Custom Question"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-full bg-neutral-900 border border-rose-900/40 text-rose-300 hover:text-white transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
          </button>

          <button 
            onClick={handleLeaveRoom}
            className="p-2 rounded-full bg-neutral-900 border border-rose-900/40 text-neutral-400 hover:text-rose-300 transition"
            title="Exit Room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Game Interface */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col justify-center items-center z-10">
        
        {/* Heat Level Selector (Synced) */}
        <div className="w-full bg-neutral-900/80 border border-rose-900/40 p-1.5 rounded-2xl flex justify-between gap-1 mb-6 backdrop-blur-md shadow-lg">
          {[
            { id: 'mild', label: 'Sweet', icon: Heart, color: 'text-rose-400' },
            { id: 'spicy', label: 'Spicy Romantic', icon: Flame, color: 'text-amber-500' },
            { id: 'steamy', label: '18+ Steamy Wild', icon: Zap, color: 'text-rose-500' }
          ].map((level) => {
            const Icon = level.icon;
            const active = gameState.heatLevel === level.id;
            return (
              <button
                key={level.id}
                onClick={() => handleChangeHeatLevel(level.id)}
                className={`flex-1 py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-300 ${
                  active 
                    ? 'bg-gradient-to-r from-rose-900/90 to-neutral-900 text-rose-100 border border-rose-700/60 shadow-md shadow-rose-950' 
                    : 'text-neutral-400 hover:text-rose-200 hover:bg-neutral-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? level.color : 'opacity-60'}`} />
                <span>{level.label}</span>
              </button>
            );
          })}
        </div>

        {/* Synchronized Turn Indicator */}
        <div className="mb-4 text-center">
          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-widest shadow-inner ${
            isMyTurn 
              ? 'bg-amber-950/80 border-amber-600/60 text-amber-300 animate-pulse' 
              : 'bg-rose-950/80 border-rose-800/40 text-rose-300'
          }`}>
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            {isMyTurn ? "Your Turn to Answer!" : `${gameState.activeTurnRole}'s Turn to Answer`}
          </span>
        </div>

        {/* Dynamic Card Container */}
        <div className="w-full bg-gradient-to-b from-neutral-900/90 to-neutral-950/90 border border-rose-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative flex flex-col justify-between min-h-[320px] transition-all duration-500">
          
          {/* Top Card Badge */}
          <div className="flex justify-between items-center border-b border-rose-900/30 pb-4 mb-4">
            <span className="text-xs text-rose-400/80 font-mono tracking-wider uppercase">
              Question Loop #{gameState.cardCount || 1}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
              gameState.heatLevel === 'mild' ? 'border-rose-800/60 text-rose-300 bg-rose-950/40' :
              gameState.heatLevel === 'spicy' ? 'border-amber-700/60 text-amber-300 bg-amber-950/40' :
              'border-rose-600/60 text-rose-200 bg-rose-900/60 animate-pulse'
            }`}>
              {gameState.heatLevel.toUpperCase()}
            </span>
          </div>

          {/* Question Text / Dare View */}
          <div className="my-auto text-center px-2 sm:px-4 py-4">
            {gameState.activeDare ? (
              <div className="animate-fade-in space-y-3">
                <div className="inline-block px-3 py-1 bg-amber-950/80 border border-amber-600/50 text-amber-300 rounded-full text-xs font-semibold">
                  🔥 DARE / FORFEIT IN EFFECT!
                </div>
                <p className="text-lg sm:text-xl font-serif text-amber-100 leading-relaxed">
                  "{gameState.activeDare}"
                </p>
              </div>
            ) : (
              <p className="text-lg sm:text-2xl font-serif text-rose-100 leading-relaxed tracking-wide">
                "{gameState.currentQuestion}"
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-rose-900/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => handleNextTurn(true)}
              disabled={!isMyTurn}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 disabled:opacity-40 disabled:hover:from-rose-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" /> Answered (+10 pts)
            </button>

            <button
              onClick={handleTriggerDare}
              disabled={!isMyTurn}
              className="py-3 px-4 rounded-xl bg-neutral-900 border border-amber-600/40 hover:bg-amber-950/30 disabled:opacity-40 text-amber-300 font-medium text-sm flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Flame className="w-4 h-4 text-amber-400" /> Take a Dare
            </button>

            <button
              onClick={() => handleNextTurn(false)}
              disabled={!isMyTurn}
              className="py-3 px-4 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-rose-200 hover:bg-neutral-900 disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> Skip Card
            </button>
          </div>

        </div>
      </main>

      {/* Floating Interactive Chat Drawer Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative bg-gradient-to-r from-rose-700 to-amber-600 text-white p-4 rounded-full shadow-2xl border border-rose-400/30 hover:scale-105 active:scale-95 transition"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-400 text-neutral-950 font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Collapsible Real-Time Chat Drawer */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-neutral-900/95 border border-rose-800/50 rounded-3xl shadow-2xl backdrop-blur-2xl z-50 flex flex-col h-[420px] overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* Chat Header */}
          <div className="p-4 bg-rose-950/80 border-b border-rose-900/40 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-serif text-sm font-bold text-rose-100">Live Sensual Whispers</h3>
            </div>
            <button 
              onClick={() => setIsChatOpen(false)}
              className="text-neutral-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Message List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs sm:text-sm">
            {(gameState.messages || []).map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.system ? 'items-center text-center my-2' : msg.senderRole === userRole ? 'items-end' : 'items-start'}`}
              >
                {msg.system ? (
                  <span className="bg-rose-950/60 border border-rose-900/40 text-rose-300 px-3 py-1 rounded-full text-xs">
                    {msg.text}
                  </span>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl p-3 ${
                    msg.senderRole === userRole 
                      ? 'bg-rose-900/80 border border-rose-700/50 text-rose-100 rounded-br-none' 
                      : 'bg-neutral-800 border border-amber-900/40 text-amber-100 rounded-bl-none'
                  }`}>
                    <div className="text-[10px] text-rose-300/60 mb-0.5 flex justify-between gap-2">
                      <span className="font-semibold text-amber-300">{msg.senderRole}</span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="leading-snug">{msg.text}</p>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-neutral-950/80 border-t border-rose-900/40 flex gap-2">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Whisper to partner as ${userRole}...`}
              className="flex-1 bg-neutral-900 border border-rose-900/40 rounded-xl px-3 py-2 text-xs text-rose-100 placeholder-neutral-500 focus:outline-none focus:border-rose-500"
            />
            <button 
              type="submit"
              className="bg-rose-700 hover:bg-rose-600 text-white p-2 rounded-xl transition flex items-center justify-center"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Add Custom Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-rose-800/60 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-serif text-rose-100 mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Add Custom Prompt
            </h2>
            <p className="text-xs text-neutral-400 mb-4">Add your own secret question to the live room deck.</p>

            <form onSubmit={handleAddCustomQuestion} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-rose-300 font-semibold mb-1 block">Question Intensity</label>
                <select
                  value={customHeat}
                  onChange={(e) => setCustomHeat(e.target.value)}
                  className="w-full bg-neutral-950 border border-rose-900/50 rounded-xl px-3 py-2 text-sm text-rose-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="mild">Sweet & Romantic</option>
                  <option value="spicy">Spicy Romantic</option>
                  <option value="steamy">18+ Steamy Wild</option>
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-rose-300 font-semibold mb-1 block">Your Custom Question</label>
                <textarea 
                  value={customQ}
                  onChange={(e) => setCustomQ(e.target.value)}
                  placeholder="Type your spicy question here..."
                  className="w-full bg-neutral-950 border border-rose-900/50 rounded-xl p-3 text-sm text-rose-100 placeholder-neutral-600 focus:outline-none focus:border-rose-500 h-24 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-rose-700 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-rose-950/50 transition"
              >
                Sync To Room Deck
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-3 text-center text-[11px] text-rose-300/40 border-t border-rose-900/20 z-10">
        Velvet & Vows • Live Real-Time Room: <span className="text-rose-200 font-mono">{roomCode}</span>
      </footer>

    </div>
  );
}