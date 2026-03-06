/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Beer, History, Plus, RotateCcw, Trash2, Trophy, Clock, Info, ChevronRight, X, User, GlassWater, Wine, Martini, Settings, BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { BeerEntry, Session, UserProfile, DrinkType } from './types';

const STORAGE_KEY = 'beer_tracker_sessions';
const PROFILE_KEY = 'alco_tracker_profile';

const DRINK_TYPES: DrinkType[] = [
  { id: 'beer-10', name: 'Pivo 10°', volume: 0.5, abv: 4.0, icon: 'beer' },
  { id: 'beer-12', name: 'Pivo 12°', volume: 0.5, abv: 5.0, icon: 'beer' },
  { id: 'beer-small-10', name: 'Malé pivo 10°', volume: 0.3, abv: 4.0, icon: 'beer' },
  { id: 'beer-small-12', name: 'Malé pivo 12°', volume: 0.3, abv: 5.0, icon: 'beer' },
  { id: 'wine-white', name: 'Biele víno', volume: 0.2, abv: 12.0, icon: 'wine' },
  { id: 'wine-red', name: 'Červené víno', volume: 0.2, abv: 13.0, icon: 'wine' },
  { id: 'shot-40', name: 'Tvrdé (40%)', volume: 0.04, abv: 40.0, icon: 'martini' },
  { id: 'shot-52', name: 'Tvrdé (52%)', volume: 0.04, abv: 52.0, icon: 'martini' },
];

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [pendingStartTime, setPendingStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [customDrink, setCustomDrink] = useState({ category: 'beer', volume: 500, abv: 5.0 });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [customDrinkSessionId, setCustomDrinkSessionId] = useState<string | null>(null);
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>(DRINK_TYPES[0].id);
  const [profile, setProfile] = useState<UserProfile>({ weight: 80, gender: 'male', age: 30 });
  const [bubbles, setBubbles] = useState<{ id: number; left: string; size: string; duration: string; delay: string }[]>([]);

  // Initialize bubbles
  useEffect(() => {
    const newBubbles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 10 + 5}px`,
      duration: `${Math.random() * 3 + 2}s`,
      delay: `${Math.random() * 5}s`,
    }));
    setBubbles(newBubbles);
  }, []);

  // Load data from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem(STORAGE_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        const active = parsed.find((s: Session) => !s.endTime);
        if (active) setCurrentSession(active);
      } catch (e) { console.error('Failed to parse sessions', e); }
    }

    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) { console.error('Failed to parse profile', e); }
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const calculateBAC = (session: Session, user: UserProfile, atTime: number = Date.now()) => {
    if (!session.beers.length) return 0;

    const r = user.gender === 'male' ? 0.68 : 0.55;
    const beta = 0.15; // Elimination rate per hour (permille)
    
    // Sort drinks by time just in case
    const sortedDrinks = [...session.beers].sort((a, b) => a.timestamp - b.timestamp);
    
    let currentBAC = 0;
    let lastEventTime = sortedDrinks[0].timestamp;

    sortedDrinks.forEach(drink => {
      if (drink.timestamp > atTime) return;

      // 1. Calculate elimination since the last drink
      const hoursPassed = (drink.timestamp - lastEventTime) / 3600000;
      currentBAC = Math.max(0, currentBAC - (beta * hoursPassed));

      // 2. Add the new drink's contribution
      // Alcohol density is ~0.789 g/ml
      const grams = drink.volume * 1000 * (drink.abv / 100) * 0.789;
      const drinkContribution = grams / (user.weight * r);
      currentBAC += drinkContribution;

      lastEventTime = drink.timestamp;
    });

    // 3. Final elimination from the last drink until atTime
    const finalHours = (atTime - lastEventTime) / 3600000;
    currentBAC = Math.max(0, currentBAC - (beta * finalHours));
    
    return Math.max(0, currentBAC);
  };

  const getSoberTime = (session: Session, user: UserProfile) => {
    const currentBAC = calculateBAC(session, user);
    if (currentBAC <= 0) return null;

    const beta = 0.15;
    const hoursToSober = currentBAC / beta;
    return new Date(Date.now() + hoursToSober * 3600000);
  };

  const startNewSession = (startTime: number = Date.now()) => {
    const newSession: Session = {
      id: Date.now().toString(),
      startTime: startTime,
      beers: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
  };

  const addDrink = () => {
    if (!currentSession) {
      startNewSession();
      return;
    }

    const drinkType = DRINK_TYPES.find(d => d.id === selectedDrinkId)!;
    const newDrink: BeerEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      type: drinkType.name,
      volume: drinkType.volume,
      abv: drinkType.abv,
    };

    const updatedSession = {
      ...currentSession,
      beers: [...currentSession.beers, newDrink],
    };

    setCurrentSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const addCustomDrink = () => {
    const categoryNames: Record<string, string> = {
      beer: 'Vlastné pivo',
      wine: 'Vlastné víno',
      martini: 'Vlastný drink'
    };

    const drinkData = {
      type: `${categoryNames[customDrink.category] || 'Vlastný'} (${customDrink.volume}ml, ${customDrink.abv}%)`,
      volume: customDrink.volume / 1000,
      abv: customDrink.abv,
    };

    if (customDrinkSessionId) {
      addDrinkToSession(customDrinkSessionId, drinkData);
      setCustomDrinkSessionId(null);
    } else {
      if (!currentSession) {
        startNewSession();
        return;
      }

      const newDrink: BeerEntry = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        ...drinkData
      };

      const updatedSession = {
        ...currentSession,
        beers: [...currentSession.beers, newDrink],
      };

      setCurrentSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    }
    setShowCustomModal(false);
  };

  const endSession = () => {
    if (!currentSession) return;
    const updatedSession = { ...currentSession, endTime: Date.now() };
    setCurrentSession(null);
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const updateSessionTimes = (sessionId: string, newStartTime: number, newEndTime?: number) => {
    setSessions(prev => {
      const updatedSessions = prev.map(session => {
        if (session.id !== sessionId) return session;

        const effectiveEndTime = newEndTime || Date.now();
        const drinkCount = session.beers.length;
        
        const updatedBeers = session.beers.map((beer, index) => {
          let newTimestamp = newStartTime;
          if (drinkCount > 1) {
            const interval = (effectiveEndTime - newStartTime) / (drinkCount - 1);
            newTimestamp = newStartTime + (index * interval);
          } else if (drinkCount === 1) {
            newTimestamp = newStartTime;
          }
          return { ...beer, timestamp: newTimestamp };
        });

        return {
          ...session,
          startTime: newStartTime,
          endTime: newEndTime,
          beers: updatedBeers
        };
      });

      const updatedSession = updatedSessions.find(s => s.id === sessionId);
      if (currentSession?.id === sessionId && updatedSession) {
        if (newEndTime) {
          setCurrentSession(null);
        } else {
          setCurrentSession(updatedSession);
        }
      }

      return updatedSessions;
    });
  };

  const [confirmConfig, setConfirmConfig] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSession?.id === id) setCurrentSession(null);
    if (selectedSessionId === id) setSelectedSessionId(null);
    setConfirmConfig(null);
  };

  const getDrinkIcon = (iconName: string, size = 16) => {
    switch (iconName) {
      case 'beer': return <Beer size={size} />;
      case 'wine': return <Wine size={size} />;
      case 'martini': return <Martini size={size} />;
      default: return <Beer size={size} />;
    }
  };

  const addDrinkToSession = (sessionId: string, drink: Omit<BeerEntry, 'id' | 'timestamp'>) => {
    setSessions(prev => {
      const updatedSessions = prev.map(session => {
        if (session.id !== sessionId) return session;
        
        const newDrink: BeerEntry = {
          ...drink,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: session.endTime || Date.now()
        };

        const updatedSession = {
          ...session,
          beers: [...session.beers, newDrink]
        };

        // Redistribute drinks after adding a new one to maintain equal spacing
        const effectiveEndTime = updatedSession.endTime || Date.now();
        const drinkCount = updatedSession.beers.length;
        const redistributedBeers = updatedSession.beers.map((b, index) => {
          let newTimestamp = updatedSession.startTime;
          if (drinkCount > 1) {
            const interval = (effectiveEndTime - updatedSession.startTime) / (drinkCount - 1);
            newTimestamp = updatedSession.startTime + (index * interval);
          }
          return { ...b, timestamp: newTimestamp };
        });

        return { ...updatedSession, beers: redistributedBeers };
      });

      const updatedSession = updatedSessions.find(s => s.id === sessionId);
      if (currentSession?.id === sessionId && updatedSession) {
        setCurrentSession(updatedSession);
      }

      return updatedSessions;
    });
  };

  const removeDrinkFromSession = (sessionId: string, drinkId: string) => {
    setSessions(prev => {
      const updatedSessions = prev.map(session => {
        if (session.id !== sessionId) return session;
        
        const updatedBeers = session.beers.filter(b => b.id !== drinkId);
        
        // Redistribute remaining drinks
        const effectiveEndTime = session.endTime || Date.now();
        const drinkCount = updatedBeers.length;
        const redistributedBeers = updatedBeers.map((b, index) => {
          let newTimestamp = session.startTime;
          if (drinkCount > 1) {
            const interval = (effectiveEndTime - session.startTime) / (drinkCount - 1);
            newTimestamp = session.startTime + (index * interval);
          } else if (drinkCount === 1) {
            newTimestamp = session.startTime;
          }
          return { ...b, timestamp: newTimestamp };
        });

        return { ...session, beers: redistributedBeers };
      });

      const updatedSession = updatedSessions.find(s => s.id === sessionId);
      if (currentSession?.id === sessionId && updatedSession) {
        setCurrentSession(updatedSession);
      }

      return updatedSessions;
    });
  };

  const currentBAC = useMemo(() => 
    currentSession ? calculateBAC(currentSession, profile) : 0, 
    [currentSession, profile, sessions]
  );

  const soberTimeInfo = useMemo(() => {
    if (!currentSession) return null;
    const time = getSoberTime(currentSession, profile);
    if (!time) return null;
    
    const diffMs = time.getTime() - Date.now();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
      time,
      hours,
      minutes,
      formattedDuration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    };
  }, [currentSession, profile, sessions]);

  const globalStats = useMemo(() => {
    if (sessions.length === 0) return null;
    let totalBeers = 0;
    let totalAlcoholGrams = 0;
    
    sessions.forEach(s => {
      totalBeers += s.beers.length;
      s.beers.forEach(b => {
        totalAlcoholGrams += (b.volume * 1000 * (b.abv / 100) * 0.789);
      });
    });

    return {
      avgBeers: (totalBeers / sessions.length).toFixed(1),
      totalSessions: sessions.length,
      totalBeers,
      totalAlcoholGrams: totalAlcoholGrams.toFixed(1),
    };
  }, [sessions]);

  const selectedSession = useMemo(() => 
    sessions.find(s => s.id === selectedSessionId), 
    [sessions, selectedSessionId]
  );

  const selectedSessionStats = useMemo(() => {
    if (!selectedSession) return null;
    const bac = calculateBAC(selectedSession, profile, selectedSession.endTime || Date.now());
    const soberAt = getSoberTime(selectedSession, profile);
    let durationFormatted = 'N/A';
    if (soberAt) {
      const diffMs = soberAt.getTime() - Date.now();
      const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      durationFormatted = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    return {
      bac: bac.toFixed(2),
      soberAt,
      durationFormatted,
      totalAlcohol: selectedSession.beers.reduce((acc, b) => acc + (b.volume * 1000 * (b.abv / 100) * 0.789), 0).toFixed(1),
    };
  }, [selectedSession, profile]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-6 pb-12 overflow-hidden">
      {/* Background Bubbles */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {bubbles.map(b => (
          <div key={b.id} className="bubble" style={{ left: b.left, width: b.size, height: b.size, animationDuration: b.duration, animationDelay: b.delay }} />
        ))}
      </div>

      {/* Header */}
      <header className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Beer className="text-zinc-950" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AlcoTracker</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStats(true)} className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors" title="Štatistiky">
            <BarChart3 size={20} />
          </button>
          <button onClick={() => setShowProfile(true)} className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors" title="Profil">
            <User size={20} />
          </button>
          <button onClick={() => setShowHistory(true)} className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors" title="História">
            <History size={20} />
          </button>
        </div>
      </header>

      {/* Main Counter */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md z-10 py-8">
        <AnimatePresence mode="wait">
          {!currentSession ? (
            <motion.div key="no-session" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center w-full">
              <div className="mb-8 p-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl backdrop-blur-sm">
                <GlassWater className="mx-auto mb-4 text-amber-500" size={48} />
                <h2 className="text-3xl font-bold mb-6">Nová jazda</h2>
                
                <div className="mb-6 w-full text-left">
                  <label className="block text-zinc-500 text-[10px] uppercase tracking-widest mb-2 px-1">Kedy si začal piť?</label>
                  <input 
                    type="datetime-local" 
                    value={pendingStartTime}
                    onChange={(e) => setPendingStartTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                </div>

                <button 
                  onClick={() => startNewSession(new Date(pendingStartTime).getTime())} 
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Plus size={24} />
                  Začať jazdu
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="active-session" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col items-center">
              <div className="relative mb-4 text-center">
                <motion.div key={currentBAC} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[100px] font-black text-amber-500 leading-none drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  {currentBAC.toFixed(2)}
                </motion.div>
                <div className="text-zinc-500 font-medium uppercase tracking-widest text-sm">
                  Aktuálne promile (‰)
                </div>
              </div>

              {soberTimeInfo && (
                <div className="mb-8 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-sm font-bold flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Triezvy o: {soberTimeInfo.time.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className="text-[10px] opacity-70 uppercase tracking-wider">Za {soberTimeInfo.formattedDuration}</span>
                </div>
              )}

              {/* Drink Type Grid */}
              <div className="grid grid-cols-2 gap-2 w-full mb-8 max-h-[200px] overflow-y-auto p-1">
                {DRINK_TYPES.map(drink => (
                  <button
                    key={drink.id}
                    onClick={() => setSelectedDrinkId(drink.id)}
                    className={`p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                      selectedDrinkId === drink.id 
                        ? 'bg-amber-500 border-amber-400 text-zinc-950 shadow-lg' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {drink.icon === 'beer' && <Beer size={18} />}
                    {drink.icon === 'wine' && <Wine size={18} />}
                    {drink.icon === 'martini' && <Martini size={18} />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold leading-tight">{drink.name}</span>
                      <span className="text-[10px] opacity-70">{drink.volume * 1000}ml • {drink.abv}%</span>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomModal(true)}
                  className="p-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all text-left flex items-center gap-3"
                >
                  <Plus size={18} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-tight">Vlastný...</span>
                    <span className="text-[10px] opacity-70">Iný objem / %</span>
                  </div>
                </button>
              </div>

              <button
                onClick={addDrink}
                className="w-full py-6 bg-amber-500 rounded-2xl flex flex-col items-center justify-center shadow-2xl shadow-amber-500/40 active:scale-95 transition-all border-b-4 border-amber-600"
              >
                <Plus size={32} className="text-zinc-950" />
                <span className="text-zinc-950 font-black text-xl">PRIDAŤ DRINK</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Actions */}
      {currentSession && (
        <footer className="w-full max-w-md grid grid-cols-2 gap-4 z-10">
          <button onClick={endSession} className="py-3 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 font-medium hover:text-zinc-100 transition-colors flex items-center justify-center gap-2">
            <RotateCcw size={18} /> Koniec
          </button>
          <button onClick={() => setConfirmConfig({ message: 'Zmazať jazdu?', onConfirm: () => deleteSession(currentSession.id) })} className="py-3 px-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
            <Trash2 size={18} /> Zmazať
          </button>
        </footer>
      )}

      {/* Statistics Modal */}
      <AnimatePresence>
        {showStats && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-2xl font-bold">Celkové štatistiky</h2>
              <button onClick={() => setShowStats(false)} className="p-2 bg-zinc-900 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              {!globalStats ? (
                <div className="text-center py-20 text-zinc-500">
                  <BarChart3 className="mx-auto mb-4 opacity-20" size={64} />
                  <p>Zatiaľ nemáš žiadne dáta na zobrazenie štatistík.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
                        <Trophy size={24} />
                      </div>
                      <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Celkový alkohol</div>
                      <div className="text-4xl font-black text-amber-500">{globalStats.totalAlcoholGrams} g</div>
                      <div className="text-zinc-500 text-sm mt-1">čistého etanolu</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl">
                      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Počet jázd</div>
                      <div className="text-2xl font-bold">{globalStats.totalSessions}</div>
                    </div>
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl">
                      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Všetky drinky</div>
                      <div className="text-2xl font-bold">{globalStats.totalBeers}</div>
                    </div>
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl">
                      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Priemer / jazda</div>
                      <div className="text-2xl font-bold">{globalStats.avgBeers}</div>
                    </div>
                    <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl">
                      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Stav</div>
                      <div className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                        <TrendingUp size={14} /> Aktívny
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
                    <h4 className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2">
                      <Info size={16} /> Vedel si?
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Svetová zdravotnícka organizácia (WHO) odporúča pre mužov neprekračovať 2 standardné drinky denne a pre ženy 1 drink, s aspoň dvoma dňami bez alkoholu týždenne.
                    </p>
                  </div>
                </>
              )}
              <button onClick={() => setShowStats(false)} className="w-full py-4 bg-zinc-100 text-zinc-950 font-bold rounded-2xl mt-4">Zavrieť</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfile && (
          <motion.div initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }} className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-2xl font-bold">Môj Profil</h2>
              <button onClick={() => setShowProfile(false)} className="p-2 bg-zinc-900 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Pohlavie</label>
                <div className="flex gap-2">
                  <button onClick={() => setProfile({...profile, gender: 'male'})} className={`flex-1 py-3 rounded-xl border font-bold ${profile.gender === 'male' ? 'bg-amber-500 border-amber-400 text-zinc-950' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>Muž</button>
                  <button onClick={() => setProfile({...profile, gender: 'female'})} className={`flex-1 py-3 rounded-xl border font-bold ${profile.gender === 'female' ? 'bg-amber-500 border-amber-400 text-zinc-950' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>Žena</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Váha (kg)</label>
                <input type="number" value={profile.weight} onChange={(e) => setProfile({...profile, weight: Number(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xl font-bold focus:border-amber-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Vek</label>
                <input type="number" value={profile.age} onChange={(e) => setProfile({...profile, age: Number(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xl font-bold focus:border-amber-500 outline-none" />
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 text-sm">
                <Info size={18} className="mb-2" />
                Tieto údaje sú nevyhnutné pre presný výpočet hladiny alkoholu v krvi pomocou Widmarkovho vzorca.
              </div>
              <button onClick={() => setShowProfile(false)} className="w-full py-4 bg-zinc-100 text-zinc-950 font-bold rounded-2xl">Uložiť profil</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Drink Modal */}
      <AnimatePresence>
        {showCustomModal && (
          <motion.div initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }} className="fixed inset-0 bg-zinc-950 z-[60] flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-2xl font-bold">Vlastný drink</h2>
              <button onClick={() => { setShowCustomModal(false); setCustomDrinkSessionId(null); }} className="p-2 bg-zinc-900 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-8 overflow-y-auto">
              {/* Category Presets */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase">Kategória</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'beer', name: 'Pivo', vol: 500, abv: 5 },
                    { id: 'wine', name: 'Víno', vol: 200, abv: 12 },
                    { id: 'martini', name: 'Tvrdé', vol: 40, abv: 40 }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCustomDrink({ category: cat.id, volume: cat.vol, abv: cat.abv })}
                      className={`py-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                        customDrink.category === cat.id ? 'bg-amber-500 border-amber-400 text-zinc-950' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {cat.id === 'beer' && <Beer size={20} />}
                      {cat.id === 'wine' && <Wine size={20} />}
                      {cat.id === 'martini' && <Martini size={20} />}
                      <span className="text-xs font-bold">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Objem (ml)</label>
                  <span className="text-2xl font-black text-amber-500">{customDrink.volume} ml</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={customDrink.volume}
                  onChange={(e) => setCustomDrink({ ...customDrink, volume: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex gap-2">
                  {[40, 100, 200, 300, 500].map(v => (
                    <button key={v} onClick={() => setCustomDrink({ ...customDrink, volume: v })} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">{v}ml</button>
                  ))}
                </div>
              </div>

              {/* ABV Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Obsah alkoholu (%)</label>
                  <span className="text-2xl font-black text-amber-500">{customDrink.abv} %</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="0.1"
                  value={customDrink.abv}
                  onChange={(e) => setCustomDrink({ ...customDrink, abv: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex gap-2">
                  {[4, 5, 12, 14, 40, 52].map(a => (
                    <button key={a} onClick={() => setCustomDrink({ ...customDrink, abv: a })} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">{a}%</button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={addCustomDrink}
                  className="w-full py-5 bg-amber-500 text-zinc-950 font-black text-xl rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
                >
                  {customDrinkSessionId ? 'PRIDAŤ DO HISTÓRIE' : 'PRIDAŤ DRINK'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-zinc-800">
              <h2 className="text-2xl font-bold">História</h2>
              <button onClick={() => { setShowHistory(false); setSelectedSessionId(null); }} className="p-2 bg-zinc-900 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {!selectedSessionId && (
                <section className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500"><Info className="mx-auto mb-4 opacity-20" size={48} /><p>Žiadne záznamy.</p></div>
                  ) : (
                    sessions.map(session => (
                      <button key={session.id} onClick={() => setSelectedSessionId(session.id)} className="w-full p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-between text-left">
                        <div>
                          <div className="text-sm text-zinc-500">{new Date(session.startTime).toLocaleDateString('sk-SK')}</div>
                          <div className="text-xl font-bold">{session.beers.length} drinkov</div>
                        </div>
                        <ChevronRight className="text-zinc-700" />
                      </button>
                    ))
                  )}
                </section>
              )}

              {selectedSessionId && selectedSession && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
                  <button onClick={() => setSelectedSessionId(null)} className="text-amber-500 font-bold flex items-center gap-1 text-sm"><X size={16} /> Späť</button>
                  <h3 className="text-3xl font-black">Detail jazdy</h3>
                  
                  <div className="space-y-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} /> Začiatok
                      </label>
                      <input 
                        type="datetime-local" 
                        value={new Date(selectedSession.startTime).toISOString().slice(0, 16)}
                        onChange={(e) => updateSessionTimes(selectedSession.id, new Date(e.target.value).getTime(), selectedSession.endTime)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs font-bold focus:border-amber-500 outline-none min-w-0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={12} /> Koniec
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="datetime-local" 
                          value={selectedSession.endTime ? new Date(selectedSession.endTime).toISOString().slice(0, 16) : ''}
                          onChange={(e) => updateSessionTimes(selectedSession.id, selectedSession.startTime, e.target.value ? new Date(e.target.value).getTime() : undefined)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs font-bold focus:border-amber-500 outline-none min-w-0"
                          placeholder="Prebieha..."
                        />
                        {!selectedSession.endTime && (
                          <button 
                            onClick={() => updateSessionTimes(selectedSession.id, selectedSession.startTime, Date.now())}
                            className="px-4 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs"
                          >
                            Ukončiť
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <div className="text-zinc-500 text-[10px] uppercase mb-1">Max Promile</div>
                      <div className="text-xl font-bold text-amber-500">{selectedSessionStats?.bac} ‰</div>
                    </div>
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <div className="text-zinc-500 text-[10px] uppercase mb-1">Triezvy o / za</div>
                      <div className="text-lg font-bold leading-tight">
                        {selectedSessionStats?.soberAt?.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) || 'N/A'}
                        <div className="text-[10px] text-zinc-500 font-normal">za {selectedSessionStats?.durationFormatted}</div>
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <div className="text-zinc-500 text-[10px] uppercase mb-1">Čistý alkohol</div>
                      <div className="text-lg font-bold">{selectedSessionStats?.totalAlcohol} g</div>
                    </div>
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <div className="text-zinc-500 text-[10px] uppercase mb-1">Drinkov</div>
                      <div className="text-lg font-bold">{selectedSession.beers.length}</div>
                    </div>
                  </div>
                  <section>
                    <div className="flex flex-col gap-4 mb-4">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Zoznam drinkov</h4>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {DRINK_TYPES.map((drink) => (
                          <button 
                            key={drink.id}
                            onClick={() => addDrinkToSession(selectedSession.id, { type: drink.name, volume: drink.volume, abv: drink.abv })}
                            className="flex-shrink-0 p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-amber-500 hover:bg-zinc-800 transition-colors flex flex-col items-center gap-1 min-w-[85px] relative group/btn"
                            title={`Pridať ${drink.name}`}
                          >
                            <div className="absolute top-1 right-1 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                              <Plus size={10} />
                            </div>
                            {getDrinkIcon(drink.icon, 18)}
                            <div className="flex flex-col items-center w-full overflow-hidden">
                              <span className="text-[8px] font-bold uppercase truncate w-full text-center leading-tight">{drink.name}</span>
                              <span className="text-[7px] text-zinc-500 font-medium truncate w-full text-center">{drink.volume * 1000}ml • {drink.abv}%</span>
                            </div>
                          </button>
                        ))}
                        <button 
                          onClick={() => {
                            setCustomDrinkSessionId(selectedSession.id);
                            setShowCustomModal(true);
                          }}
                          className="flex-shrink-0 p-2 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl text-zinc-500 hover:border-amber-500 hover:text-amber-500 transition-colors flex flex-col items-center gap-1 min-w-[85px]"
                          title="Pridať vlastný drink"
                        >
                          <Plus size={18} />
                          <div className="flex flex-col items-center w-full overflow-hidden">
                            <span className="text-[8px] font-bold uppercase truncate w-full text-center leading-tight">Vlastný</span>
                            <span className="text-[7px] text-zinc-500 font-medium truncate w-full text-center">Iný objem / %</span>
                          </div>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {selectedSession.beers.map((beer, idx) => (
                        <div key={beer.id} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500 font-bold">{idx + 1}.</span>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{beer.type}</span>
                              <span className="text-[10px] text-zinc-500">{beer.volume * 1000}ml • {beer.abv}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-zinc-500">{new Date(beer.timestamp).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}</span>
                            <button 
                              onClick={() => removeDrinkFromSession(selectedSession.id, beer.id)}
                              className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {selectedSession.beers.length === 0 && (
                        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-600 text-xs">
                          Žiadne drinky v tejto jazde.
                        </div>
                      )}
                    </div>
                  </section>
                  
                  <div className="pt-8">
                    <button 
                      onClick={() => setConfirmConfig({
                        message: 'Naozaj chcete vymazať celú túto jazdu?',
                        onConfirm: () => deleteSession(selectedSession.id)
                      })}
                      className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={18} /> Vymazať celú jazdu
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setConfirmConfig(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Potvrdenie</h3>
              <p className="text-zinc-400 text-sm mb-6">{confirmConfig.message}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmConfig(null)} className="py-3 bg-zinc-800 text-zinc-100 font-bold rounded-xl hover:bg-zinc-700 transition-colors">Zrušiť</button>
                <button onClick={confirmConfig.onConfirm} className="py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">Zmazať</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
