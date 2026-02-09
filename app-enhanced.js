// Helper to get sport emoji
function getSportEmoji(sport) {
    const emojis = {
        'NRL': '🏉', 'Rugby': '🏉', 'Cricket': '🏏', 'NBA': '🏀',
        'Horse Racing': '🏇', 'F1': '🏎️', 'Soccer': '⚽', 'AFL': '🏈',
        'Tennis': '🎾', 'Other': '🎯'
    };
    return emojis[sport] || '🎯';
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(view + '-view').classList.add('active');
    event.currentTarget.classList.add('active');
    updateUI();
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    if (modalId === 'addBetModal') {
        updateMemberDropdown();
    } else if (modalId === 'managePoolModal') {
        updateContributionsManagement();
    } else if (modalId === 'setBetOfWeekModal') {
        updateBetOfWeekSelection();
    }
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal.id);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('betStake').addEventListener('input', calculateReturn);
    document.getElementById('betOdds').addEventListener('input', calculateReturn);
});

function calculateReturn() {
    const stake = parseFloat(document.getElementById('betStake').value) || 0;
    const odds = parseFloat(document.getElementById('betOdds').value) || 0;
    document.getElementById('betReturn').value = (stake * odds).toFixed(2);
}

function updateMemberDropdown() {
    const select = document.getElementById('betMember');
    select.innerHTML = '<option value="">Select...</option>';
    window.members.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
}

async function saveMembersToFirestore() {
    try {
        await window.setDoc(window.doc(window.db, 'config', 'members'), { members: window.members });
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Error saving');
    }
}

// BET FORM
document.getElementById('betForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    
    try {
        const memberId = parseInt(document.getElementById('betMember').value);
        const member = window.members.find(m => m.id === memberId);
        
        const bet = {
            id: Date.now(),
            memberId,
            memberName: member?.name,
            sport: document.getElementById('betSport').value,
            event: document.getElementById('betSport').value,
            selection: document.getElementById('betSelection').value,
            type: document.getElementById('betType').value,
            stake: parseFloat(document.getElementById('betStake').value),
            odds: parseFloat(document.getElementById('betOdds').value),
            potentialReturn: parseFloat(document.getElementById('betReturn').value),
            eventDate: document.getElementById('betDate').value,
            status: 'pending',
            result: null,
            placedDate: new Date().toISOString()
        };
        
        await window.addDoc(window.collection(window.db, 'bets'), bet);
        
        hideModal('addBetModal');
        document.getElementById('betForm').reset();
        hideLoading();
        showToast('Bet placed!');
        
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        showToast('Error placing bet');
    }
});

async function deleteBet(firestoreId) {
    if (confirm('Delete this bet?')) {
        showLoading();
        try {
            await window.deleteDoc(window.doc(window.db, 'bets', firestoreId));
            hideLoading();
            showToast('Deleted');
        } catch (error) {
            hideLoading();
            showToast('Error');
        }
    }
}

function openSettleModal(betId) {
    const bet = window.bets.find(b => b.id === betId);
    if (!bet) return;
    
    window.currentSettleBetId = betId;
    document.getElementById('settleBetInfo').innerHTML = `
        <div style="padding: 15px; background: #f8f9fa; border-radius: 10px;">
            <div style="font-size: 1.2em; font-weight: 600; margin-bottom: 8px;">${getSportEmoji(bet.sport)} ${bet.selection}</div>
            <div style="color: #666; margin-bottom: 10px;">${bet.memberName} • ${bet.type}</div>
            <div style="padding-top: 10px; border-top: 1px solid #ddd;">
                <div>Stake: <strong>$${bet.stake.toFixed(2)}</strong></div>
                <div>Odds: <strong>${bet.odds}</strong></div>
                <div>Potential: <strong style="color: var(--gold);">$${bet.potentialReturn.toFixed(2)}</strong></div>
            </div>
        </div>
    `;
    showModal('settleBetModal');
}

async function settleBetResult(result) {
    if (!window.currentSettleBetId) return;
    
    showLoading();
    try {
        const bet = window.bets.find(b => b.id === window.currentSettleBetId);
        if (!bet) return;
        
        if (result === 'won') {
            bet.result = bet.potentialReturn - bet.stake;
            bet.status = 'won';
        } else if (result === 'lost') {
            bet.result = -bet.stake;
            bet.status = 'lost';
        } else {
            bet.result = 0;
            bet.status = 'void';
        }
        
        await window.updateDoc(window.doc(window.db, 'bets', bet.firestoreId), {
            result: bet.result,
            status: bet.status
        });
        
        hideModal('settleBetModal');
        window.currentSettleBetId = null;
        hideLoading();
        showToast('Settled!');
        
    } catch (error) {
        hideLoading();
        showToast('Error');
    }
}

// EVENT FORM
document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    
    try {
        const event = {
            id: Date.now(),
            name: document.getElementById('eventName').value,
            type: document.getElementById('eventType').value,
            location: document.getElementById('eventLocation').value,
            dateTime: document.getElementById('eventDateTime').value,
            cost: parseFloat(document.getElementById('eventCost').value) || 0,
            description: document.getElementById('eventDescription').value,
            attendees: [],
            status: 'upcoming',
            createdDate: new Date().toISOString()
        };
        
        await window.addDoc(window.collection(window.db, 'events'), event);
        
        hideModal('addEventModal');
        document.getElementById('eventForm').reset();
        hideLoading();
        showToast('Event created!');
        
    } catch (error) {
        hideLoading();
        showToast('Error');
    }
});

function openManageEventModal(eventId) {
    const event = window.events.find(e => e.id === eventId);
    if (!event) return;
    
    window.currentEventId = eventId;
    
    const eventTypeEmoji = event.type === 'Pub' ? '🍺' : event.type === 'Dinner' ? '🍽️' : 
                           event.type === 'Race Day' ? '🏇' : event.type === 'Trip' ? '✈️' : 
                           event.type === 'Party' ? '🎉' : '🎯';
    
    document.getElementById('eventManagementContent').innerHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
            <h3 style="margin-bottom: 10px;">${eventTypeEmoji} ${event.name}</h3>
            <div style="font-size: 0.9em; color: #666;">
                <div>📍 ${event.location}</div>
                <div>📅 ${new Date(event.dateTime).toLocaleString()}</div>
                ${event.cost > 0 ? `<div style="margin-top: 5px; font-weight: 600; color: var(--danger);">💸 $${event.cost.toFixed(2)} from pool</div>` : ''}
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">Attendees (${event.attendees.length})</h4>
            <div class="attendees-list">
                ${event.attendees.map(name => `<span class="attendee-chip">${name}</span>`).join('')}
                ${event.attendees.length === 0 ? '<div style="color: #999; font-size: 0.9em;">None yet</div>' : ''}
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <select id="attendeeSelect" style="width: 100%; padding: 10px; border: 2px solid var(--border); border-radius: 8px; margin-bottom: 10px;">
                <option value="">Add attendee...</option>
                ${window.members.map(m => `<option value="${m.name}">${m.name}</option>`).join('')}
            </select>
            <button class="btn btn-gold btn-small" onclick="addAttendee()" style="width: 100%;">Add</button>
        </div>

        ${event.status === 'upcoming' ? `
            <button class="btn btn-success" onclick="completeEvent()">✅ Complete Event</button>
        ` : ''}
        
        <button class="btn btn-danger" onclick="deleteEvent('${event.firestoreId}')">Delete</button>
    `;
    
    showModal('manageEventModal');
}

async function addAttendee() {
    const name = document.getElementById('attendeeSelect').value;
    if (!name) return;
    
    const event = window.events.find(e => e.id === window.currentEventId);
    if (!event || event.attendees.includes(name)) return;
    
    showLoading();
    try {
        event.attendees.push(name);
        await window.updateDoc(window.doc(window.db, 'events', event.firestoreId), {
            attendees: event.attendees
        });
        hideLoading();
        openManageEventModal(window.currentEventId);
    } catch (error) {
        hideLoading();
    }
}

async function completeEvent() {
    const event = window.events.find(e => e.id === window.currentEventId);
    if (!event || event.attendees.length === 0) {
        alert('Add attendees first');
        return;
    }
    
    if (!confirm(`Complete event and deduct $${event.cost.toFixed(2)}?`)) return;
    
    showLoading();
    try {
        await window.updateDoc(window.doc(window.db, 'events', event.firestoreId), {
            status: 'completed'
        });
        hideModal('manageEventModal');
        hideLoading();
        showToast('Event completed!');
    } catch (error) {
        hideLoading();
    }
}

async function deleteEvent(firestoreId) {
    if (confirm('Delete event?')) {
        showLoading();
        try {
            await window.deleteDoc(window.doc(window.db, 'events', firestoreId));
            hideModal('manageEventModal');
            hideLoading();
            showToast('Deleted');
        } catch (error) {
            hideLoading();
        }
    }
}

// UI UPDATES
function updateUI() {
    if (!window.firestoreLoaded) return;
    initializeFilters();
    updateDashboard();
    updateHotHand();
    updateRecentBets();
    updateUpcomingEvents();
    updateAllBets();
    updateAllEvents();
    updateLeaderboard();
    updateAwardsSection();
    updateMembers();
    updateBetOfWeekDisplay();
}

function updateDashboard() {
    const totalPool = window.members.reduce((sum, m) => sum + (m.contribution || 0), 0);
    const totalStaked = window.bets.reduce((sum, bet) => sum + bet.stake, 0);
    const totalProfit = window.bets.reduce((sum, bet) => sum + (bet.result || 0), 0);
    const activeBets = window.bets.filter(b => b.status === 'pending').length;
    
    document.getElementById('totalPool').textContent = `$${totalPool.toFixed(0)}`;
    document.getElementById('activeBets').textContent = activeBets;
    document.getElementById('totalStaked').textContent = `$${totalStaked.toFixed(0)}`;
    document.getElementById('totalProfit').textContent = `$${totalProfit.toFixed(0)}`;
    
    const profitCard = document.getElementById('profitCard');
    profitCard.style.background = totalProfit >= 0 ? 
        'linear-gradient(135deg, #6ba587 0%, #5a8a6f 100%)' : 
        'linear-gradient(135deg, #c17171 0%, #a85858 100%)';
}

function updateHotHand() {
    const container = document.getElementById('hotHandSection');
    
    // Find member with best recent form (last 5 bets)
    const memberPerformance = window.members.map(member => {
        const recentBets = window.bets
            .filter(b => b.memberId === member.id && b.status !== 'pending')
            .slice(0, 5);
        
        if (recentBets.length < 3) return null;
        
        const recentProfit = recentBets.reduce((sum, b) => sum + (b.result || 0), 0);
        return { member, recentProfit, betsCount: recentBets.length };
    }).filter(p => p !== null).sort((a, b) => b.recentProfit - a.recentProfit);
    
    if (memberPerformance.length === 0 || memberPerformance[0].recentProfit <= 0) {
        container.innerHTML = '';
        return;
    }
    
    const hotHand = memberPerformance[0];
    container.innerHTML = `
        <div class="hot-hand-card">
            <div style="font-size: 2em; margin-bottom: 5px;">🔥</div>
            <h3>Hot Hand</h3>
            <div style="font-size: 1.8em; font-weight: 700; margin: 10px 0;">${hotHand.member.name}</div>
            <div style="font-size: 1em; opacity: 0.9;">
                +$${hotHand.recentProfit.toFixed(0)} in last ${hotHand.betsCount} bets
            </div>
        </div>
    `;
}

function updateRecentBets() {
    const container = document.getElementById('recentBetsList');
    const recent = window.bets.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎲</div><div>No bets yet</div></div>';
        return;
    }
    
    container.innerHTML = recent.map(bet => createBetCard(bet, false)).join('');
}

function updateUpcomingEvents() {
    const container = document.getElementById('upcomingEventsList');
    const upcoming = window.events.filter(e => e.status === 'upcoming').slice(0, 3);
    
    if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div>No upcoming events</div></div>';
        return;
    }
    
    container.innerHTML = upcoming.map(event => createEventCard(event, false)).join('');
}

function initializeFilters() {
    const memberFilter = document.getElementById('memberFilter');
    memberFilter.innerHTML = '<option value="all">All Members</option>';
    window.members.forEach(m => {
        memberFilter.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
}

function updateAllBets() {
    const container = document.getElementById('allBetsList');
    const statusFilter = document.getElementById('statusFilter').value;
    const memberFilter = document.getElementById('memberFilter').value;
    
    let filtered = window.bets.slice();
    
    if (statusFilter !== 'all') filtered = filtered.filter(b => b.status === statusFilter);
    if (memberFilter !== 'all') filtered = filtered.filter(b => b.memberId === parseInt(memberFilter));
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div>No matches</div></div>';
        return;
    }
    
    container.innerHTML = filtered.map(bet => createBetCard(bet, true)).join('');
}

function createBetCard(bet, showActions = false) {
    const eventDate = new Date(bet.eventDate);
    const statusClass = bet.status === 'won' ? 'won' : bet.status === 'lost' ? 'lost' : '';
    const emoji = getSportEmoji(bet.sport);
    
    return `
        <div class="bet-item ${statusClass}">
            <div class="bet-header">
                <div class="bet-title">${emoji} ${bet.selection}</div>
                <div class="bet-status ${bet.status}">${bet.status}</div>
            </div>
            <div class="bet-details">
                <div><strong>${bet.memberName}</strong> • ${bet.type}</div>
                <div>Odds: ${bet.odds} @ $${bet.stake.toFixed(2)} • ${eventDate.toLocaleDateString()}</div>
            </div>
            <div class="bet-amount">
                <span class="stake">Stake: $${bet.stake.toFixed(2)}</span>
                ${bet.result !== null ? 
                    `<span class="result ${bet.result >= 0 ? 'profit' : 'loss'}">${bet.result >= 0 ? '+' : ''}$${bet.result.toFixed(2)}</span>` : 
                    `<span style="color: var(--gold);">$${bet.potentialReturn.toFixed(2)}</span>`
                }
            </div>
            ${showActions ? `
                <div class="bet-actions">
                    ${bet.status === 'pending' ? 
                        `<button class="btn btn-success btn-small" onclick="openSettleModal(${bet.id})">Settle</button>` : ''
                    }
                    <button class="btn btn-danger btn-small" onclick="deleteBet('${bet.firestoreId}')">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
}

function updateAllEvents() {
    const container = document.getElementById('allEventsList');
    
    if (window.events.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div>No events yet</div></div>';
        return;
    }
    
    const upcoming = window.events.filter(e => e.status === 'upcoming');
    const completed = window.events.filter(e => e.status === 'completed');
    
    let html = '';
    
    if (upcoming.length > 0) {
        html += '<h3 style="margin-bottom: 10px; color: var(--primary);">Upcoming</h3>';
        html += upcoming.map(e => createEventCard(e, true)).join('');
    }
    
    if (completed.length > 0) {
        html += '<h3 style="margin: 20px 0 10px; color: var(--primary);">Completed</h3>';
        html += completed.map(e => createEventCard(e, true)).join('');
    }
    
    container.innerHTML = html;
}

function createEventCard(event, showActions) {
    const date = new Date(event.dateTime);
    const typeEmoji = event.type === 'Pub' ? '🍺' : event.type === 'Dinner' ? '🍽️' : 
                      event.type === 'Race Day' ? '🏇' : event.type === 'Trip' ? '✈️' : 
                      event.type === 'Party' ? '🎉' : '🎯';
    
    return `
        <div class="event-item">
            <div class="event-header">
                <div class="event-title">${typeEmoji} ${event.name}</div>
                <div class="event-status ${event.status}">${event.status}</div>
            </div>
            <div class="event-details">
                <div>📍 ${event.location}</div>
                <div>📅 ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                ${event.cost > 0 ? `<div>💸 $${event.cost.toFixed(2)}</div>` : ''}
            </div>
            <div class="attendees-list">
                ${event.attendees.map(name => `<span class="attendee-chip">${name}</span>`).join('')}
            </div>
            ${showActions ? `
                <div class="event-actions">
                    <button class="btn btn-gold btn-small" onclick="openManageEventModal(${event.id})">Manage</button>
                </div>
            ` : ''}
        </div>
    `;
}

function getMemberStats(memberId) {
    const memberBets = window.bets.filter(b => b.memberId === memberId && b.status !== 'pending');
    const wonBets = memberBets.filter(b => b.status === 'won');
    const lostBets = memberBets.filter(b => b.status === 'lost');
    const totalProfit = memberBets.reduce((sum, b) => sum + (b.result || 0), 0);
    const totalStaked = window.bets.filter(b => b.memberId === memberId).reduce((sum, b) => sum + b.stake, 0);
    
    const winRate = memberBets.length > 0 ? (wonBets.length / memberBets.length * 100) : 0;
    const roi = totalStaked > 0 ? (totalProfit / totalStaked * 100) : 0;
    const avgStake = window.bets.filter(b => b.memberId === memberId).length > 0 ? 
                     totalStaked / window.bets.filter(b => b.memberId === memberId).length : 0;
    
    const bestWin = memberBets.length > 0 ? Math.max(...memberBets.map(b => b.result || 0)) : 0;
    const worstLoss = memberBets.length > 0 ? Math.min(...memberBets.map(b => b.result || 0)) : 0;
    const biggestOdds = window.bets.filter(b => b.memberId === memberId).length > 0 ? 
                        Math.max(...window.bets.filter(b => b.memberId === memberId).map(b => b.odds)) : 0;
    
    // Current streak
    const allBets = window.bets.filter(b => b.memberId === memberId).reverse();
    let streak = 0;
    let streakType = null;
    for (const bet of allBets) {
        if (bet.status === 'pending') continue;
        if (!streakType) {
            streakType = bet.status;
            streak = 1;
        } else if (bet.status === streakType) {
            streak++;
        } else {
            break;
        }
    }
    
    // Last 5 form
    const last5 = allBets.filter(b => b.status !== 'pending').slice(0, 5).reverse();
    
    return {
        totalBets: window.bets.filter(b => b.memberId === memberId).length,
        wonBets: wonBets.length,
        lostBets: lostBets.length,
        totalProfit,
        totalStaked,
        winRate,
        roi,
        avgStake,
        bestWin,
        worstLoss,
        biggestOdds,
        streak,
        streakType,
        last5
    };
}

function updateLeaderboard() {
    const container = document.getElementById('leaderboardList');
    
    const rankings = window.members.map(member => {
        const stats = getMemberStats(member.id);
        return { member, ...stats };
    }).sort((a, b) => b.totalProfit - a.totalProfit);
    
    container.innerHTML = rankings.map((r, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        const rankEmoji = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
        
        return `
            <div class="leaderboard-item ${rankClass}">
                <div class="rank">${rankEmoji}</div>
                <div class="member-info">
                    <div class="member-name">${r.member.name}</div>
                    <div class="member-stats-small">${r.totalBets} bets • ${r.winRate.toFixed(0)}% win</div>
                </div>
                <div class="member-profit" style="color: ${r.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${r.totalProfit >= 0 ? '+' : ''}$${r.totalProfit.toFixed(0)}
                </div>
            </div>
        `;
    }).join('');
}

function updateAwardsSection() {
    const container = document.getElementById('awardsSection');
    
    if (window.bets.length === 0) {
        container.innerHTML = '<div class="empty-state-icon">🏆</div><div>Awards appear after bets are placed</div>';
        return;
    }
    
    // Calculate awards
    const allStats = window.members.map(m => ({ member: m, stats: getMemberStats(m.id) }));
    
    const bigSpender = allStats.sort((a,b) => b.stats.totalStaked - a.stats.totalStaked)[0];
    const highRoller = allStats.sort((a,b) => b.stats.avgStake - a.stats.avgStake)[0];
    const sharpShooter = allStats.filter(a => a.stats.totalBets >= 5).sort((a,b) => b.stats.winRate - a.stats.winRate)[0];
    const darkHorse = allStats.sort((a,b) => b.stats.bestWin - a.stats.bestWin)[0];
    const dangerZone = allStats.filter(a => a.stats.worstLoss < 0).sort((a,b) => a.stats.worstLoss - b.stats.worstLoss)[0];
    
    let html = '<div class="badge-container">';
    
    if (bigSpender && bigSpender.stats.totalStaked > 0) {
        html += `<div class="badge gold">💸 Big Spender: ${bigSpender.member.name} ($${bigSpender.stats.totalStaked.toFixed(0)})</div>`;
    }
    
    if (highRoller && highRoller.stats.avgStake > 0) {
        html += `<div class="badge info">🎰 High Roller: ${highRoller.member.name} ($${highRoller.stats.avgStake.toFixed(0)} avg)</div>`;
    }
    
    if (sharpShooter) {
        html += `<div class="badge success">🎯 Sharp Shooter: ${sharpShooter.member.name} (${sharpShooter.stats.winRate.toFixed(0)}%)</div>`;
    }
    
    if (darkHorse && darkHorse.stats.bestWin > 0) {
        html += `<div class="badge gold">🐎 Dark Horse: ${darkHorse.member.name} ($${darkHorse.stats.bestWin.toFixed(0)})</div>`;
    }
    
    if (dangerZone) {
        html += `<div class="badge danger">📉 Danger Zone: ${dangerZone.member.name} ($${dangerZone.stats.worstLoss.toFixed(0)})</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function updateMembers() {
    const poolSummary = document.getElementById('poolSummary');
    const contributionsList = document.getElementById('contributionsList');
    const performanceList = document.getElementById('memberPerformanceList');
    
    const totalContributions = window.members.reduce((sum, m) => sum + (m.contribution || 0), 0);
    const totalProfit = window.bets.reduce((sum, b) => sum + (b.result || 0), 0);
    const eventCosts = window.events.filter(e => e.status === 'completed').reduce((sum, e) => sum + e.cost, 0);
    const netPool = totalContributions + totalProfit - eventCosts;
    
    poolSummary.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; text-align: center; margin-bottom: 15px;">
            <div>
                <div style="font-size: 0.85em; color: #666;">Total Contributions</div>
                <div style="font-size: 2em; font-weight: 700; color: var(--gold);">$${totalContributions.toFixed(0)}</div>
            </div>
            <div>
                <div style="font-size: 0.85em; color: #666;">Betting P/L</div>
                <div style="font-size: 2em; font-weight: 700; color: ${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(0)}
                </div>
            </div>
            <div>
                <div style="font-size: 0.85em; color: #666;">Event Costs</div>
                <div style="font-size: 2em; font-weight: 700; color: var(--danger);">-$${eventCosts.toFixed(0)}</div>
            </div>
            <div>
                <div style="font-size: 0.85em; color: #666;">Net Pool</div>
                <div style="font-size: 2em; font-weight: 700; color: var(--primary);">$${netPool.toFixed(0)}</div>
            </div>
        </div>
    `;
    
    // Contributions
    contributionsList.innerHTML = window.members.map(m => `
        <div class="contribution-tracker">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: 600; font-size: 1.1em;">${m.name}</div>
                <div class="contribution-amount">$${(m.contribution || 0).toFixed(0)}</div>
            </div>
        </div>
    `).join('');
    
    // Performance
    performanceList.innerHTML = window.members.map(member => {
        const stats = getMemberStats(member.id);
        
        return `
            <div class="member-item">
                <div style="font-weight: 600; font-size: 1.1em; margin-bottom: 10px;">${member.name}</div>
                
                ${stats.last5.length > 0 ? `
                    <div style="margin-bottom: 10px;">
                        <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">Last 5:</div>
                        <div class="form-guide">
                            ${stats.last5.map(b => `
                                <div class="form-guide-item ${b.status}">
                                    ${b.status === 'won' ? 'W' : b.status === 'lost' ? 'L' : 'P'}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${stats.streak > 1 ? `
                    <div style="margin-bottom: 10px;">
                        <span class="badge ${stats.streakType === 'won' ? 'success' : 'danger'}">
                            ${stats.streakType === 'won' ? '🔥' : '❄️'} ${stats.streak} ${stats.streakType === 'won' ? 'win' : 'loss'} streak
                        </span>
                    </div>
                ` : ''}
                
                <div class="stat-detail-grid">
                    <div class="stat-detail-item">
                        <div class="stat-label">P/L</div>
                        <div class="stat-value ${stats.totalProfit >= 0 ? 'positive' : 'negative'}">
                            ${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(0)}
                        </div>
                    </div>
                    <div class="stat-detail-item">
                        <div class="stat-label">Win Rate</div>
                        <div class="stat-value">${stats.winRate.toFixed(0)}%</div>
                    </div>
                    <div class="stat-detail-item">
                        <div class="stat-label">Best Win</div>
                        <div class="stat-value positive">$${stats.bestWin.toFixed(0)}</div>
                    </div>
                    <div class="stat-detail-item">
                        <div class="stat-label">Worst Loss</div>
                        <div class="stat-value negative">$${stats.worstLoss.toFixed(0)}</div>
                    </div>
                    <div class="stat-detail-item">
                        <div class="stat-label">ROI</div>
                        <div class="stat-value ${stats.roi >= 0 ? 'positive' : 'negative'}">${stats.roi.toFixed(1)}%</div>
                    </div>
                    <div class="stat-detail-item">
                        <div class="stat-label">Biggest Odds</div>
                        <div class="stat-value">${stats.biggestOdds.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateContributionsManagement() {
    const container = document.getElementById('contributionsManagementList');
    container.innerHTML = window.members.map(m => `
        <div class="member-item" style="margin-bottom: 15px;">
            <div style="font-weight: 600; margin-bottom: 10px;">${m.name}</div>
            <div style="display: flex; gap: 10px; align-items: end;">
                <div style="flex: 1;">
                    <label style="font-size: 0.85em; color: #666; margin-bottom: 5px; display: block;">Total Contributed</label>
                    <input type="number" value="${m.contribution || 0}" 
                           onchange="updateContribution(${m.id}, this.value)"
                           style="width: 100%; padding: 10px; border: 2px solid var(--gold); border-radius: 8px; font-size: 1.1em; font-weight: 600;">
                </div>
                <button class="btn btn-gold btn-small" onclick="addContribution(${m.id})">+ Add</button>
            </div>
        </div>
    `).join('');
}

async function updateContribution(memberId, newAmount) {
    const member = window.members.find(m => m.id === memberId);
    if (member) {
        member.contribution = parseFloat(newAmount) || 0;
        await saveMembersToFirestore();
        showToast(`${member.name}: $${member.contribution.toFixed(0)}`);
    }
}

async function addContribution(memberId) {
    const amount = prompt('Add how much?');
    if (amount && !isNaN(amount)) {
        const member = window.members.find(m => m.id === memberId);
        if (member) {
            member.contribution = (member.contribution || 0) + parseFloat(amount);
            await saveMembersToFirestore();
            showToast(`+$${amount} added`);
            updateContributionsManagement();
        }
    }
}

function updateBetOfWeekDisplay() {
    updateBetOfWeekDashboard();
    updateBetOfWeekBetsTab();
}

function updateBetOfWeekDashboard() {
    const container = document.getElementById('betOfTheWeekDashboard');
    
    if (!window.betOfTheWeek) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⭐</div><div>No bet selected</div></div>';
        return;
    }
    
    const bet = window.bets.find(b => b.id === window.betOfTheWeek);
    if (!bet) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⭐</div><div>Bet not found</div></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="bet-item" style="border: 3px solid var(--gold); background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);">
            <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 2em;">⭐</div>
                <div style="font-size: 1.3em; font-weight: 700; color: var(--primary);">${getSportEmoji(bet.sport)} ${bet.selection}</div>
            </div>
            <div style="text-align: center; margin-bottom: 10px;">
                <div><strong>${bet.memberName}</strong></div>
                <div style="color: #666;">${bet.type} @ ${bet.odds}</div>
                <div style="color: var(--gold); font-weight: 600; font-size: 1.2em;">$${bet.stake.toFixed(0)} → $${bet.potentialReturn.toFixed(0)}</div>
            </div>
            ${bet.result !== null ? 
                `<div style="text-align: center; font-size: 1.3em; font-weight: 700; color: ${bet.result >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    ${bet.result >= 0 ? '✅' : '❌'} ${bet.result >= 0 ? '+' : ''}$${bet.result.toFixed(0)}
                </div>` : 
                `<div style="text-align: center; font-style: italic; color: #666;">Pending...</div>`
            }
        </div>
    `;
}

function updateBetOfWeekBetsTab() {
    const container = document.getElementById('betOfTheWeekDisplay');
    
    if (!window.betOfTheWeek) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⭐</div><div>None selected</div></div>';
        return;
    }
    
    const bet = window.bets.find(b => b.id === window.betOfTheWeek);
    if (!bet) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⭐</div><div>Not found</div></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="bet-item" style="border: 3px solid var(--gold);">
            ${createBetCard(bet, false).replace('class="bet-item', 'style="background: transparent; border: none; padding: 0; margin: 0;" class="')}
            <button class="btn btn-danger btn-small" onclick="clearBetOfWeek()" style="margin-top: 10px; width: 100%;">Clear</button>
        </div>
    `;
}

function updateBetOfWeekSelection() {
    const container = document.getElementById('betOfWeekSelectionList');
    const pending = window.bets.filter(b => b.status === 'pending');
    
    if (pending.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>No pending bets</div></div>';
        return;
    }
    
    container.innerHTML = pending.map(bet => `
        <div class="bet-item" style="cursor: pointer;" onclick="setBetOfWeek(${bet.id})">
            <div style="font-weight: 600;">${getSportEmoji(bet.sport)} ${bet.selection}</div>
            <div style="font-size: 0.9em; color: #666;">
                ${bet.memberName} • ${bet.type} @ ${bet.odds} • $${bet.stake.toFixed(0)}
            </div>
        </div>
    `).join('');
}

async function setBetOfWeek(betId) {
    try {
        await window.setDoc(window.doc(window.db, 'config', 'betOfTheWeek'), { betId });
        hideModal('setBetOfWeekModal');
        showToast('Bet of week set!');
    } catch (error) {
        showToast('Error');
    }
}

async function clearBetOfWeek() {
    if (confirm('Clear bet of week?')) {
        try {
            await window.setDoc(window.doc(window.db, 'config', 'betOfTheWeek'), { betId: null });
            showToast('Cleared');
        } catch (error) {
            showToast('Error');
        }
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid var(--gold);';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
