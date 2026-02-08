// Loading overlay
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

// View switching
function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(view + '-view').classList.add('active');
    event.currentTarget.classList.add('active');
    updateUI();
}

// Modal management
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    if (modalId === 'addBetModal') {
        updateMemberDropdown();
    } else if (modalId === 'manageBankrollModal') {
        updateBankrollManagement();
    } else if (modalId === 'setBetOfWeekModal') {
        updateBetOfWeekSelection();
    }
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Click outside modal to close
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modal.id);
        }
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Auto-calculate return
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
    select.innerHTML = '<option value="">Select Member</option>';
    window.members.forEach(member => {
        select.innerHTML += `<option value="${member.id}">${member.name}</option>`;
    });
}

// Save members to Firebase
async function saveMembersToFirestore() {
    try {
        await window.setDoc(window.doc(window.db, 'config', 'members'), { members: window.members });
    } catch (error) {
        console.error('Error saving members:', error);
        showToast('Error saving to database');
    }
}

// ============================================
// BETS FUNCTIONALITY
// ============================================

// Bet form
document.getElementById('betForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    
    try {
        const memberId = parseInt(document.getElementById('betMember').value);
        const stake = parseFloat(document.getElementById('betStake').value);
        const member = window.members.find(m => m.id === memberId);
        
        if (member && member.bankroll < stake) {
            hideLoading();
            alert(`Insufficient bankroll! ${member.name} has $${member.bankroll.toFixed(2)} but needs $${stake.toFixed(2)}`);
            return;
        }
        
        const bet = {
            id: Date.now(),
            memberId: memberId,
            memberName: member?.name,
            sport: document.getElementById('betSport').value,
            event: document.getElementById('betSport').value,
            selection: document.getElementById('betSelection').value,
            type: document.getElementById('betType').value,
            stake: stake,
            odds: parseFloat(document.getElementById('betOdds').value),
            potentialReturn: parseFloat(document.getElementById('betReturn').value),
            eventDate: document.getElementById('betDate').value,
            notes: '',
            status: 'pending',
            result: null,
            placedDate: new Date().toISOString()
        };
        
        if (member) {
            member.bankroll = (member.bankroll || 0) - stake;
            await saveMembersToFirestore();
        }
        
        await window.addDoc(window.collection(window.db, 'bets'), bet);
        
        hideModal('addBetModal');
        document.getElementById('betForm').reset();
        hideLoading();
        showToast('Bet placed successfully!');
        
    } catch (error) {
        console.error('Error placing bet:', error);
        hideLoading();
        showToast('Error placing bet');
    }
});

async function deleteBet(firestoreId, betId) {
    const bet = window.bets.find(b => b.id === betId);
    if (bet && confirm('Delete this bet?')) {
        showLoading();
        try {
            if (bet.status === 'pending') {
                const member = window.members.find(m => m.id === bet.memberId);
                if (member) {
                    member.bankroll = (member.bankroll || 0) + bet.stake;
                    await saveMembersToFirestore();
                }
            }
            
            await window.deleteDoc(window.doc(window.db, 'bets', firestoreId));
            hideLoading();
            showToast('Bet deleted');
            
        } catch (error) {
            console.error('Error deleting bet:', error);
            hideLoading();
            showToast('Error deleting bet');
        }
    }
}

function openSettleModal(betId) {
    const bet = window.bets.find(b => b.id === betId);
    if (!bet) return;
    
    window.currentSettleBetId = betId;
    document.getElementById('settleBetInfo').innerHTML = `
        <div style="margin-bottom: 8px;"><strong>${bet.selection}</strong></div>
        <div style="font-size: 0.9em; color: #666;">${bet.event}</div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
            <div>Stake: <strong>$${bet.stake.toFixed(2)}</strong></div>
            <div>Odds: <strong>${bet.odds}</strong></div>
            <div>Potential: <strong>$${bet.potentialReturn.toFixed(2)}</strong></div>
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
        
        const member = window.members.find(m => m.id === bet.memberId);
        
        if (result === 'won') {
            bet.result = bet.potentialReturn - bet.stake;
            bet.status = 'won';
            if (member) {
                member.bankroll = (member.bankroll || 0) + bet.potentialReturn;
            }
        } else if (result === 'lost') {
            bet.result = -bet.stake;
            bet.status = 'lost';
        } else {
            bet.result = 0;
            bet.status = 'void';
            if (member) {
                member.bankroll = (member.bankroll || 0) + bet.stake;
            }
        }
        
        await window.updateDoc(window.doc(window.db, 'bets', bet.firestoreId), {
            result: bet.result,
            status: bet.status
        });
        
        if (member) {
            await saveMembersToFirestore();
        }
        
        hideModal('settleBetModal');
        window.currentSettleBetId = null;
        hideLoading();
        showToast('Bet settled!');
        
    } catch (error) {
        console.error('Error settling bet:', error);
        hideLoading();
        showToast('Error settling bet');
    }
}

// ============================================
// EVENTS FUNCTIONALITY
// ============================================

// Event form
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
        showToast('Event created successfully!');
        
    } catch (error) {
        console.error('Error creating event:', error);
        hideLoading();
        showToast('Error creating event');
    }
});

function openManageEventModal(eventId) {
    const event = window.events.find(e => e.id === eventId);
    if (!event) return;
    
    window.currentEventId = eventId;
    
    const content = document.getElementById('eventManagementContent');
    content.innerHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
            <h3 style="margin-bottom: 10px;">${event.name}</h3>
            <div style="font-size: 0.9em; color: #666;">
                <div>${event.type} • ${event.location}</div>
                <div>${new Date(event.dateTime).toLocaleString()}</div>
                ${event.cost > 0 ? `<div style="margin-top: 5px; font-weight: 600;">Cost: $${event.cost.toFixed(2)}</div>` : ''}
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">Attendees (${event.attendees.length})</h4>
            <div class="attendees-list">
                ${event.attendees.map(name => `<span class="attendee-chip">${name}</span>`).join('')}
                ${event.attendees.length === 0 ? '<div style="color: #999; font-size: 0.9em;">No attendees yet</div>' : ''}
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">Add Attendee</h4>
            <select id="attendeeSelect" style="width: 100%; padding: 10px; border: 2px solid var(--border); border-radius: 8px; margin-bottom: 10px;">
                <option value="">Select member...</option>
                ${window.members.map(m => `<option value="${m.name}">${m.name}</option>`).join('')}
            </select>
            <button class="btn btn-gold btn-small" onclick="addAttendee()" style="width: 100%;">Add Attendee</button>
        </div>

        ${event.status === 'upcoming' ? `
            <button class="btn btn-success" onclick="completeEvent()" style="margin-bottom: 10px;">Mark as Completed</button>
        ` : ''}
        
        <button class="btn btn-danger" onclick="deleteEvent('${event.firestoreId}', ${event.id})">Delete Event</button>
    `;
    
    showModal('manageEventModal');
}

async function addAttendee() {
    const select = document.getElementById('attendeeSelect');
    const attendeeName = select.value;
    
    if (!attendeeName) {
        alert('Please select a member');
        return;
    }
    
    const event = window.events.find(e => e.id === window.currentEventId);
    if (!event) return;
    
    if (event.attendees.includes(attendeeName)) {
        alert('This member is already attending');
        return;
    }
    
    showLoading();
    try {
        event.attendees.push(attendeeName);
        
        await window.updateDoc(window.doc(window.db, 'events', event.firestoreId), {
            attendees: event.attendees
        });
        
        hideLoading();
        showToast('Attendee added!');
        openManageEventModal(window.currentEventId);
        
    } catch (error) {
        console.error('Error adding attendee:', error);
        hideLoading();
        showToast('Error adding attendee');
    }
}

async function completeEvent() {
    const event = window.events.find(e => e.id === window.currentEventId);
    if (!event) return;
    
    if (event.attendees.length === 0) {
        alert('Please add attendees before completing the event');
        return;
    }
    
    if (!confirm(`Mark event as completed and deduct $${event.cost.toFixed(2)} from pooled funds?`)) {
        return;
    }
    
    showLoading();
    try {
        // Deduct cost from total pool (we'll track this separately)
        // For now, just mark as completed
        await window.updateDoc(window.doc(window.db, 'events', event.firestoreId), {
            status: 'completed'
        });
        
        hideModal('manageEventModal');
        hideLoading();
        showToast('Event completed!');
        
    } catch (error) {
        console.error('Error completing event:', error);
        hideLoading();
        showToast('Error completing event');
    }
}

async function deleteEvent(firestoreId, eventId) {
    if (confirm('Delete this event?')) {
        showLoading();
        try {
            await window.deleteDoc(window.doc(window.db, 'events', firestoreId));
            hideModal('manageEventModal');
            hideLoading();
            showToast('Event deleted');
        } catch (error) {
            console.error('Error deleting event:', error);
            hideLoading();
            showToast('Error deleting event');
        }
    }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

function updateUI() {
    if (!window.firestoreLoaded) return;
    initializeFilters();
    updateDashboard();
    updateRecentBets();
    updateUpcomingEvents();
    updateAllBets();
    updateAllEvents();
    updateLeaderboard();
    updateMembers();
    updateBetOfWeekDisplay();
}

function updateDashboard() {
    document.getElementById('totalBets').textContent = window.bets.length;
    document.getElementById('activeBets').textContent = window.bets.filter(b => b.status === 'pending').length;
    
    const totalStaked = window.bets.reduce((sum, bet) => sum + bet.stake, 0);
    document.getElementById('totalStaked').textContent = `$${totalStaked.toFixed(0)}`;
    
    const totalProfit = window.bets.reduce((sum, bet) => sum + (bet.result || 0), 0);
    const profitEl = document.getElementById('totalProfit');
    profitEl.textContent = `$${totalProfit.toFixed(0)}`;
    
    const profitCard = document.getElementById('profitCard');
    profitCard.style.background = totalProfit >= 0 ? 
        'linear-gradient(135deg, #6ba587 0%, #5a8a6f 100%)' : 
        'linear-gradient(135deg, #c17171 0%, #a85858 100%)';
}

function updateRecentBets() {
    const container = document.getElementById('recentBetsList');
    const recent = window.bets.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎲</div><div>No bets yet. Place your first bet!</div></div>';
        return;
    }
    
    container.innerHTML = recent.map(bet => createBetCard(bet)).join('');
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

function updateAllEvents() {
    const container = document.getElementById('allEventsList');
    
    if (window.events.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div>No events yet. Create your first event!</div></div>';
        return;
    }
    
    // Group by status
    const upcoming = window.events.filter(e => e.status === 'upcoming');
    const completed = window.events.filter(e => e.status === 'completed');
    
    let html = '';
    
    if (upcoming.length > 0) {
        html += '<h3 style="margin-bottom: 10px; color: var(--primary);">Upcoming</h3>';
        html += upcoming.map(event => createEventCard(event, true)).join('');
    }
    
    if (completed.length > 0) {
        html += '<h3 style="margin: 20px 0 10px; color: var(--primary);">Completed</h3>';
        html += completed.map(event => createEventCard(event, true)).join('');
    }
    
    container.innerHTML = html;
}

function createEventCard(event, showActions = false) {
    const eventDate = new Date(event.dateTime);
    
    return `
        <div class="event-item">
            <div class="event-header">
                <div class="event-title">${event.name}</div>
                <div class="event-status ${event.status}">${event.status}</div>
            </div>
            <div class="event-details">
                <div><strong>${event.type}</strong> • ${event.location}</div>
                <div>${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                ${event.cost > 0 ? `<div>Cost: <strong>$${event.cost.toFixed(2)}</strong></div>` : ''}
                ${event.description ? `<div style="margin-top: 5px; font-style: italic;">${event.description}</div>` : ''}
            </div>
            <div class="attendees-list" style="margin-top: 10px;">
                ${event.attendees.map(name => `<span class="attendee-chip">${name}</span>`).join('')}
                ${event.attendees.length === 0 ? '<span style="color: #999; font-size: 0.85em;">No attendees yet</span>' : ''}
            </div>
            ${showActions ? `
                <div class="event-actions">
                    <button class="btn btn-gold btn-small" onclick="openManageEventModal(${event.id})">Manage</button>
                </div>
            ` : ''}
        </div>
    `;
}

function initializeFilters() {
    const memberFilter = document.getElementById('memberFilter');
    memberFilter.innerHTML = '<option value="all">All Members</option>';
    window.members.forEach(member => {
        memberFilter.innerHTML += `<option value="${member.id}">${member.name}</option>`;
    });
}

function updateAllBets() {
    const container = document.getElementById('allBetsList');
    const statusFilter = document.getElementById('statusFilter').value;
    const memberFilter = document.getElementById('memberFilter').value;
    
    let filteredBets = window.bets.slice();
    
    if (statusFilter !== 'all') {
        filteredBets = filteredBets.filter(b => b.status === statusFilter);
    }
    
    if (memberFilter !== 'all') {
        filteredBets = filteredBets.filter(b => b.memberId === parseInt(memberFilter));
    }
    
    if (filteredBets.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div>No bets match your filters</div></div>';
        return;
    }
    
    container.innerHTML = filteredBets.map(bet => createBetCard(bet, true)).join('');
}

function createBetCard(bet, showActions = false) {
    const eventDate = new Date(bet.eventDate);
    const statusClass = bet.status === 'won' ? 'won' : bet.status === 'lost' ? 'lost' : '';
    
    return `
        <div class="bet-item ${statusClass}">
            <div class="bet-header">
                <div class="bet-title">${bet.selection}</div>
                <div class="bet-status ${bet.status}">${bet.status}</div>
            </div>
            <div class="bet-details">
                <div><strong>${bet.event}</strong></div>
                <div>${bet.memberName} • ${bet.type} • ${eventDate.toLocaleDateString()}</div>
                <div>Odds: ${bet.odds} @ $${bet.stake.toFixed(2)}</div>
            </div>
            <div class="bet-amount">
                <span class="stake">Stake: $${bet.stake.toFixed(2)}</span>
                ${bet.result !== null ? 
                    `<span class="result ${bet.result >= 0 ? 'profit' : 'loss'}">${bet.result >= 0 ? '+' : ''}$${bet.result.toFixed(2)}</span>` : 
                    `<span>Return: $${bet.potentialReturn.toFixed(2)}</span>`
                }
            </div>
            ${showActions ? `
                <div class="bet-actions">
                    ${bet.status === 'pending' ? 
                        `<button class="btn btn-success btn-small" onclick="openSettleModal(${bet.id})">Settle</button>` : 
                        ''
                    }
                    <button class="btn btn-danger btn-small" onclick="deleteBet('${bet.firestoreId}', ${bet.id})">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
}

function updateLeaderboard() {
    const container = document.getElementById('leaderboardList');
    const detailedContainer = document.getElementById('detailedStatsList');
    
    if (window.members.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div>No members yet.</div></div>';
        detailedContainer.innerHTML = '';
        return;
    }
    
    const memberStats = window.members.map(member => {
        const memberBets = window.bets.filter(b => b.memberId === member.id);
        const settledBets = memberBets.filter(b => b.status !== 'pending' && b.status !== 'void');
        const wonBets = memberBets.filter(b => b.status === 'won');
        const totalStaked = memberBets.reduce((sum, bet) => sum + bet.stake, 0);
        const profitLoss = memberBets.reduce((sum, bet) => sum + (bet.result || 0), 0);
        const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length * 100) : 0;
        const roi = totalStaked > 0 ? (profitLoss / totalStaked * 100) : 0;
        const avgStake = memberBets.length > 0 ? totalStaked / memberBets.length : 0;
        const bestWin = memberBets.length > 0 ? Math.max(...memberBets.map(b => b.result || 0)) : 0;
        
        return { member, profitLoss, totalBets: memberBets.length, winRate, roi, avgStake, bestWin };
    }).sort((a, b) => b.profitLoss - a.profitLoss);
    
    // Leaderboard
    container.innerHTML = memberStats.map((stat, index) => {
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        return `
            <div class="leaderboard-item ${rankClass}">
                <div class="rank">#${index + 1}</div>
                <div class="member-info">
                    <div class="member-name">${stat.member.name}</div>
                    <div class="member-stats-small">${stat.totalBets} bets • ${stat.winRate.toFixed(0)}% win rate</div>
                </div>
                <div class="member-profit" style="color: ${stat.profitLoss >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${stat.profitLoss >= 0 ? '+' : ''}$${stat.profitLoss.toFixed(0)}
                </div>
            </div>
        `;
    }).join('');
    
    // Detailed stats
    detailedContainer.innerHTML = memberStats.map(stat => `
        <div class="member-item">
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 1.1em;">${stat.member.name}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em;">
                <div>Win Rate: <strong>${stat.winRate.toFixed(1)}%</strong></div>
                <div>ROI: <strong style="color: ${stat.roi >= 0 ? 'var(--success)' : 'var(--danger)'}">${stat.roi.toFixed(1)}%</strong></div>
                <div>Avg Stake: <strong>$${stat.avgStake.toFixed(0)}</strong></div>
                <div>Best Win: <strong style="color: var(--success)">$${stat.bestWin.toFixed(0)}</strong></div>
            </div>
        </div>
    `).join('');
}

function updateMembers() {
    const container = document.getElementById('membersList');
    const bankrollSummary = document.getElementById('bankrollSummary');
    
    if (window.members.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div>No members yet.</div></div>';
        bankrollSummary.innerHTML = '';
        return;
    }
    
    // Bankroll Summary
    const totalBankroll = window.members.reduce((sum, m) => sum + (m.bankroll || 0), 0);
    const totalInitial = window.members.reduce((sum, m) => sum + (m.initialBankroll || 0), 0);
    const totalProfit = totalBankroll - totalInitial;
    
    // Calculate total event costs
    const totalEventCosts = window.events
        .filter(e => e.status === 'completed')
        .reduce((sum, e) => sum + e.cost, 0);
    
    bankrollSummary.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; text-align: center;">
            <div>
                <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">Total Bankroll</div>
                <div style="font-size: 1.5em; font-weight: 600; color: var(--gold);">$${totalBankroll.toFixed(0)}</div>
            </div>
            <div>
                <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">Initial Funds</div>
                <div style="font-size: 1.5em; font-weight: 600;">$${totalInitial.toFixed(0)}</div>
            </div>
            <div>
                <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">Betting P/L</div>
                <div style="font-size: 1.5em; font-weight: 600; color: ${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(0)}
                </div>
            </div>
            <div>
                <div style="font-size: 0.85em; color: #666; margin-bottom: 5px;">Event Costs</div>
                <div style="font-size: 1.5em; font-weight: 600; color: var(--danger);">-$${totalEventCosts.toFixed(0)}</div>
            </div>
        </div>
    `;
    
    // Members list
    container.innerHTML = window.members.map(member => {
        const memberBets = window.bets.filter(b => b.memberId === member.id);
        const totalStaked = memberBets.reduce((sum, bet) => sum + bet.stake, 0);
        const profitLoss = memberBets.reduce((sum, bet) => sum + (bet.result || 0), 0);
        const bankroll = member.bankroll || 0;
        const initialBankroll = member.initialBankroll || 0;
        const bankrollChange = bankroll - initialBankroll;
        
        return `
            <div class="member-item">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: 600; font-size: 1.1em;">${member.name}</div>
                        <div style="font-size: 0.85em; color: #666;">Bankroll: <strong style="color: var(--gold);">$${bankroll.toFixed(0)}</strong></div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.85em; color: #666;">P/L from Bankroll</div>
                        <div style="font-weight: 600; color: ${bankrollChange >= 0 ? 'var(--success)' : 'var(--danger)'};">
                            ${bankrollChange >= 0 ? '+' : ''}$${bankrollChange.toFixed(0)}
                        </div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 0.9em; padding-top: 8px; border-top: 1px solid var(--border);">
                    <div>Bets: <strong>${memberBets.length}</strong></div>
                    <div>Staked: <strong>$${totalStaked.toFixed(0)}</strong></div>
                    <div>Bet P/L: <strong style="color: ${profitLoss >= 0 ? 'var(--success)' : 'var(--danger)'}">${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(0)}</strong></div>
                </div>
            </div>
        `;
    }).join('');
}

// Bankroll Management
function updateBankrollManagement() {
    const container = document.getElementById('bankrollManagementList');
    container.innerHTML = window.members.map(member => `
        <div class="member-item" style="margin-bottom: 15px;">
            <div style="font-weight: 600; margin-bottom: 10px;">${member.name}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <label style="font-size: 0.85em; color: #666; display: block; margin-bottom: 5px;">Current Bankroll</label>
                    <input type="number" value="${member.bankroll || 0}" 
                           onchange="updateMemberBankroll(${member.id}, this.value)"
                           style="width: 100%; padding: 8px; border: 2px solid var(--border); border-radius: 8px;">
                </div>
                <div>
                    <label style="font-size: 0.85em; color: #666; display: block; margin-bottom: 5px;">Initial Bankroll</label>
                    <input type="number" value="${member.initialBankroll || 0}" readonly
                           style="width: 100%; padding: 8px; border: 2px solid var(--border); border-radius: 8px; background: #f8f9fa;">
                </div>
            </div>
            <div style="margin-top: 10px;">
                <button class="btn btn-small btn-gold" onclick="addFunds(${member.id})" style="width: 100%;">+ Add Funds</button>
            </div>
        </div>
    `).join('');
}

async function updateMemberBankroll(memberId, newBankroll) {
    const member = window.members.find(m => m.id === memberId);
    if (member) {
        member.bankroll = parseFloat(newBankroll) || 0;
        
        if (member.initialBankroll === 0 && member.bankroll > 0) {
            member.initialBankroll = member.bankroll;
        }
        
        await saveMembersToFirestore();
        showToast(`${member.name}'s bankroll updated to $${member.bankroll.toFixed(0)}`);
    }
}

async function addFunds(memberId) {
    const amount = prompt('How much to add to bankroll?');
    if (amount && !isNaN(amount)) {
        const member = window.members.find(m => m.id === memberId);
        if (member) {
            const addAmount = parseFloat(amount);
            member.bankroll = (member.bankroll || 0) + addAmount;
            member.initialBankroll = (member.initialBankroll || 0) + addAmount;
            await saveMembersToFirestore();
            showToast(`Added $${addAmount.toFixed(0)} to ${member.name}'s bankroll`);
            updateBankrollManagement();
        }
    }
}

// Bet of the Week
function updateBetOfWeekDisplay() {
    const container = document.getElementById('betOfTheWeekDisplay');
    
    if (!window.betOfTheWeek) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎯</div><div>No bet of the week selected yet</div></div>';
        return;
    }
    
    const bet = window.bets.find(b => b.id === window.betOfTheWeek);
    if (!bet) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎯</div><div>No bet of the week selected yet</div></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="bet-item" style="border-left-color: var(--gold); background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-size: 1.2em; font-weight: 600;">⭐ ${bet.selection}</div>
                <div class="bet-status ${bet.status}">${bet.status}</div>
            </div>
            <div style="margin-bottom: 8px;">
                <strong>${bet.memberName}</strong> • ${bet.sport}
            </div>
            <div style="font-size: 0.9em; color: #666; margin-bottom: 10px;">
                ${bet.type} @ ${bet.odds} • $${bet.stake.toFixed(2)} to win $${bet.potentialReturn.toFixed(2)}
            </div>
            ${bet.result !== null ? 
                `<div style="font-size: 1.1em; font-weight: 600; color: ${bet.result >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    Result: ${bet.result >= 0 ? '+' : ''}$${bet.result.toFixed(2)}
                </div>` : 
                '<div style="font-style: italic; color: #666;">Pending result...</div>'
            }
            <button class="btn btn-small btn-danger" onclick="clearBetOfWeek()" style="margin-top: 10px;">Clear</button>
        </div>
    `;
}

function updateBetOfWeekSelection() {
    const container = document.getElementById('betOfWeekSelectionList');
    const pendingBets = window.bets.filter(b => b.status === 'pending');
    
    if (pendingBets.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>No pending bets available</div></div>';
        return;
    }
    
    container.innerHTML = pendingBets.map(bet => `
        <div class="bet-item" style="cursor: pointer; margin-bottom: 10px;" onclick="setBetOfWeek(${bet.id})">
            <div style="font-weight: 600; margin-bottom: 5px;">${bet.selection}</div>
            <div style="font-size: 0.9em; color: #666;">
                ${bet.memberName} • ${bet.sport} • ${bet.type} @ ${bet.odds}
            </div>
        </div>
    `).join('');
}

async function setBetOfWeek(betId) {
    try {
        await window.setDoc(window.doc(window.db, 'config', 'betOfTheWeek'), { betId: betId });
        hideModal('setBetOfWeekModal');
        showToast('Bet of the week set!');
    } catch (error) {
        console.error('Error setting bet of week:', error);
        showToast('Error setting bet of week');
    }
}

async function clearBetOfWeek() {
    if (confirm('Clear bet of the week?')) {
        try {
            await window.setDoc(window.doc(window.db, 'config', 'betOfTheWeek'), { betId: null });
            showToast('Bet of the week cleared');
        } catch (error) {
            console.error('Error clearing bet of week:', error);
            showToast('Error clearing bet of week');
        }
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid var(--gold);';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}