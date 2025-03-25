import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    setDoc,
    addDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Firebase configuration matches other JS files
const firebaseConfig = {
    apiKey: "AIzaSyCC6oO1N3jkcLbyX0q9NYqWbR-VoRtZ-fQ",
    authDomain: "new-project-8e4ac.firebaseapp.com",
    projectId: "new-project-8e4ac",
    storageBucket: "new-project-8e4ac.firebasestorage.app",
    messagingSenderId: "921717995613",
    appId: "1:921717995613:web:539ba4a30df006c944b5b4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const createTournamentBtn = document.getElementById('create-tournament');
const tournamentForm = document.getElementById('tournament-form');
const startTournamentBtn = document.getElementById('start-tournament');
const activeTournament = document.getElementById('active-tournament');
const tournamentTitle = document.getElementById('tournament-title');
const qualifierMatches = document.getElementById('qualifier-matches');
const semifinalMatches = document.getElementById('semifinal-matches');
const finalMatches = document.getElementById('final-matches');
const tournamentLeaderboard = document.getElementById('tournament-leaderboard');
const tournamentHistoryList = document.getElementById('tournament-history-list');
const matchResultModal = document.getElementById('match-result-modal');
const modalMatchTeams = document.getElementById('modal-match-teams');
const team1ModalScore = document.getElementById('team1-modal-score');
const team2ModalScore = document.getElementById('team2-modal-score');
const saveMatchResultBtn = document.getElementById('save-match-result');
const closeModalBtn = document.querySelector('.close-modal');

// Global variables
let allPlayers = [];
let currentTournament = null;
let currentMatchForResult = null;

// Theme switcher logic
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }    
}

toggleSwitch.addEventListener('change', switchTheme);

// Check for saved theme preference
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    toggleSwitch.checked = currentTheme === 'dark';
}

// Event Listeners
createTournamentBtn.addEventListener('click', () => {
    tournamentForm.classList.toggle('hidden');
});

startTournamentBtn.addEventListener('click', createNewTournament);
saveMatchResultBtn.addEventListener('click', saveMatchResult);
closeModalBtn.addEventListener('click', () => {
    matchResultModal.classList.add('hidden');
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadPlayers();
    await loadPreviousTournaments();
    await checkActiveTournament();
});

async function loadPlayers() {
    try {
        const playersSnapshot = await getDocs(collection(db, "players"));
        allPlayers = playersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            rating: doc.data().rating || 1200
        }));
        console.log("Loaded players:", allPlayers.length);
    } catch (error) {
        console.error("Error loading players:", error);
    }
}

async function loadPreviousTournaments() {
    try {
        const tournamentsQuery = query(
            collection(db, "tournaments"),
            where("status", "==", "completed"),
            orderBy("endDate", "desc")
        );
        
        const tournamentsSnapshot = await getDocs(tournamentsQuery);
        tournamentHistoryList.innerHTML = '';
        
        if (tournamentsSnapshot.empty) {
            tournamentHistoryList.innerHTML = '<p>No previous tournaments found.</p>';
            return;
        }
        
        tournamentsSnapshot.forEach(doc => {
            const tournament = doc.data();
            const tournamentDate = tournament.endDate.toDate().toLocaleDateString();
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // Create podium HTML
            let podiumHTML = '';
            if (tournament.topPlayers && tournament.topPlayers.length > 0) {
                podiumHTML = `
                    <div class="tournament-podium">
                        ${createPodiumHTML(tournament.topPlayers)}
                    </div>
                `;
            }
            
            historyItem.innerHTML = `
                <div class="history-info">
                    <h3>${tournament.name}</h3>
                    <p>Completed: ${tournamentDate}</p>
                    <p>Winner: ${tournament.winner}</p>
                    ${podiumHTML}
                </div>
                <div class="history-details" data-id="${doc.id}">
                    View Details
                </div>
            `;
            
            tournamentHistoryList.appendChild(historyItem);
        });
        
        // Add click listeners for details
        document.querySelectorAll('.history-details').forEach(detail => {
            detail.addEventListener('click', () => {
                const tournamentId = detail.getAttribute('data-id');
                window.location.href = `tournament-details.html?id=${tournamentId}`;
            });
        });
        
    } catch (error) {
        console.error("Error loading tournaments:", error);
    }
}

// Helper function to create podium HTML
function createPodiumHTML(topPlayers) {
    // Sort players by position (1st, 2nd, 3rd)
    const sortedPlayers = [...topPlayers].sort((a, b) => a.position - b.position);
    
    // Map players to positions
    const positions = {
        1: null,
        2: null,
        3: null
    };
    
    sortedPlayers.forEach(player => {
        if (player.position >= 1 && player.position <= 3) {
            positions[player.position] = player;
        }
    });
    
    // Create podium HTML
    return `
        <div class="podium-container">
            ${positions[2] ? `
                <div class="podium-place second-place">
                    <div class="player-name">${positions[2].playerName}</div>
                    <div class="podium-block">2</div>
                </div>` : ''}
                
            ${positions[1] ? `
                <div class="podium-place first-place">
                    <div class="player-name">${positions[1].playerName}</div>
                    <div class="podium-block">1</div>
                </div>` : ''}
                
            ${positions[3] ? `
                <div class="podium-place third-place">
                    <div class="player-name">${positions[3].playerName}</div>
                    <div class="podium-block">3</div>
                </div>` : ''}
        </div>
    `;
}

async function checkActiveTournament() {
    try {
        const tournamentsQuery = query(
            collection(db, "tournaments"),
            where("status", "in", ["active", "in_progress"])
        );
        
        const tournamentsSnapshot = await getDocs(tournamentsQuery);
        
        if (!tournamentsSnapshot.empty) {
            const tournamentDoc = tournamentsSnapshot.docs[0];
            currentTournament = {
                id: tournamentDoc.id,
                ...tournamentDoc.data()
            };
            
            // Repair the tournament bracket
            repairTournamentBracket();
            
            // Validate the tournament bracket
            validateTournamentBracket();
            
            // Special handling for semifinals stage
            if (currentTournament.currentStage === 'semifinals') {
                ensureSemifinalsReady();
            }
            
            displayActiveTournament();
        }
    } catch (error) {
        console.error("Error checking active tournaments:", error);
    }
}


async function createNewTournament() {
    const tournamentName = document.getElementById('tournament-name').value.trim();
    
    if (!tournamentName) {
        alert('Please enter a tournament name');
        return;
    }
    
    if (allPlayers.length < 6) {
        alert('Not enough players for a tournament. Minimum 6 players required.');
        return;
    }
    
    try {
        // Create tournament structure
        const tournament = {
            name: tournamentName,
            status: 'active',
            currentStage: 'qualifiers',
            startDate: serverTimestamp(),
            players: shuffleArray([...allPlayers]),
            matches: [],
            standings: [],
            winner: null
        };
        
        // Create bracket structure
        tournament.matches = generateTournamentBracket(tournament.players);
        
        // Initialize standings
        tournament.standings = tournament.players.map(player => ({
            playerId: player.id,
            playerName: player.name,
            wins: 0,
            matches: 0
        }));
        
        // Save to Firestore
        const tournamentRef = await addDoc(collection(db, "tournaments"), tournament);
        currentTournament = { id: tournamentRef.id, ...tournament };
        
        // Display tournament
        displayActiveTournament();
        
        // Hide form
        tournamentForm.classList.add('hidden');
        document.getElementById('tournament-name').value = '';
        
    } catch (error) {
        console.error("Error creating tournament:", error);
        alert('Failed to create tournament');
    }
}

function generateTournamentBracket(players) {
    // Shuffle players to randomize initial matchups
    const shuffledPlayers = shuffleArray([...players]);
    
    // Create matches array
    const matches = [];
    
    // Calculate number of qualifier matches
    const numberOfPlayers = shuffledPlayers.length;
    const desiredMatches = Math.ceil(numberOfPlayers * 1.5 / 2);
    const numberOfQualifiers = Math.max(3, desiredMatches);
    const numberOfSemifinals = Math.ceil(numberOfQualifiers / 2);
    
    console.log(`Creating tournament with ${numberOfPlayers} players:`);
    console.log(`- ${numberOfQualifiers} qualifier matches`);
    console.log(`- ${numberOfSemifinals} semifinal matches`);
    console.log(`- 1 final match`);
    
    // Create player frequency counter to track how many times each player has been assigned
    const playerAssignments = {};
    shuffledPlayers.forEach(player => {
        playerAssignments[player.id] = 0;
    });
    
    // Generate qualifiers with varied team compositions
    for (let i = 0; i < numberOfQualifiers; i++) {
        // Determine which semifinal this qualifier feeds into
        // This ensures proper distribution across all semifinals
        const semifinalNumber = Math.floor(i / 2) % numberOfSemifinals + 1;
        
        // Determine if this qualifier winner goes to team1 or team2 in the semifinal
        // Alternate between team1 and team2
        const nextTeam = i % 2 === 0 ? 'team1' : 'team2';
        
        console.log(`Qualifier ${i+1} → Semifinal ${semifinalNumber} as ${nextTeam}`);
        
        // Sort players by how many times they've been assigned to matches
        const sortedPlayers = [...shuffledPlayers].sort((a, b) => 
            playerAssignments[a.id] - playerAssignments[b.id]
        );
        
        // Select the 4 least-used players for this match
        let matchPlayers = sortedPlayers.slice(0, 4);
        
        // If we don't have enough players, use players from the beginning
        while (matchPlayers.length < 4) {
            const recycledPlayers = sortedPlayers.slice(0, 4 - matchPlayers.length);
            matchPlayers = [...matchPlayers, ...recycledPlayers];
        }
        
        // Increment assignment count for these players
        matchPlayers.forEach(player => {
            playerAssignments[player.id]++;
        });
        
        // Create varied team combinations
        // For even-numbered matches, mix players differently
        if (i % 2 === 1) {
            // Alternative arrangement: players 0,2 vs players 1,3
            matches.push({
                id: `qualifier-${i + 1}`,
                stage: 'qualifiers',
                matchNumber: i + 1,
                team1: [matchPlayers[0].id, matchPlayers[2].id],
                team2: [matchPlayers[1].id, matchPlayers[3].id],
                team1Names: [matchPlayers[0].name, matchPlayers[2].name],
                team2Names: [matchPlayers[1].name, matchPlayers[3].name],
                score: [0, 0],
                winner: null,
                completed: false,
                nextMatch: semifinalNumber,  // Use the calculated semifinal number
                nextMatchTeam: nextTeam      // Use the calculated team position
            });
        } else {
            // Standard arrangement: players 0,1 vs players 2,3
            matches.push({
                id: `qualifier-${i + 1}`,
                stage: 'qualifiers',
                matchNumber: i + 1,
                team1: [matchPlayers[0].id, matchPlayers[1].id],
                team2: [matchPlayers[2].id, matchPlayers[3].id],
                team1Names: [matchPlayers[0].name, matchPlayers[1].name],
                team2Names: [matchPlayers[2].name, matchPlayers[3].name],
                score: [0, 0],
                winner: null,
                completed: false,
                nextMatch: semifinalNumber,  // Use the calculated semifinal number
                nextMatchTeam: nextTeam      // Use the calculated team position
            });
        }
    }
    
    // Log how many times each player is assigned
    console.log("Player assignments:");
    Object.entries(playerAssignments).forEach(([playerId, count]) => {
        const player = shuffledPlayers.find(p => p.id === playerId);
        console.log(`${player.name}: ${count} matches`);
    });
    
    // Create placeholders for semifinals
    for (let i = 0; i < numberOfSemifinals; i++) {
        matches.push({
            id: `semifinal-${i + 1}`,
            stage: 'semifinals',
            matchNumber: i + 1,
            team1: ['TBD', 'TBD'],
            team2: ['TBD', 'TBD'],
            team1Names: ['TBD', 'TBD'],
            team2Names: ['TBD', 'TBD'],
            score: [0, 0],
            winner: null,
            completed: false,
            nextMatch: 1,
            nextMatchTeam: i % 2 === 0 ? 'team1' : 'team2'
        });
    }
    
    // Create placeholder for final
    matches.push({
        id: 'final-1',
        stage: 'finals',
        matchNumber: 1,
        team1: ['TBD', 'TBD'],
        team2: ['TBD', 'TBD'],
        team1Names: ['TBD', 'TBD'],
        team2Names: ['TBD', 'TBD'],
        score: [0, 0],
        winner: null,
        completed: false
    });
    
    // Force validation of the bracket to double-check connections
    const qualifierFeeds = new Map();
    matches.filter(m => m.stage === 'qualifiers').forEach(m => {
        const key = `${m.nextMatch}-${m.nextMatchTeam}`;
        qualifierFeeds.set(key, m.id);
    });
    
    console.log("Qualifier feeds to semifinals:", Object.fromEntries(qualifierFeeds));
    
    return matches;
}

function displayActiveTournament() {
    if (!currentTournament) return;
    
    // Show tournament section
    activeTournament.classList.remove('hidden');
    
    // Set tournament title
    tournamentTitle.textContent = currentTournament.name;
    
    // Update progress bar
    updateTournamentProgress(currentTournament.currentStage);
    
    // Display matches by stage
    displayMatchesByStage('qualifiers', qualifierMatches);
    displayMatchesByStage('semifinals', semifinalMatches);
    displayMatchesByStage('finals', finalMatches);
    
    // Update leaderboard
    updateLeaderboard();
    
    // Add debug button if it doesn't exist
    if (!document.getElementById('debug-tournament')) {
        const debugBtn = document.createElement('button');
        debugBtn.id = 'debug-tournament';
        debugBtn.textContent = 'Debug Tournament';
        debugBtn.classList.add('secondary-button');
        debugBtn.style.marginTop = '1rem';
        debugBtn.addEventListener('click', () => {
            console.log("Current Tournament:", currentTournament);
            console.log("Matches:", currentTournament.matches);
        });
        tournamentLeaderboard.appendChild(debugBtn);
    }
}

function updateTournamentProgress(currentStage) {
    const stages = document.querySelectorAll('.progress-stage');
    let reachedCurrent = false;
    
    stages.forEach(stage => {
        const stageName = stage.getAttribute('data-stage');
        stage.classList.remove('active', 'completed');
        
        if (stageName === currentStage) {
            stage.classList.add('active');
            reachedCurrent = true;
        } else if (!reachedCurrent) {
            stage.classList.add('completed');
        }
    });
    
    // Show only the relevant bracket stage
    document.querySelectorAll('.bracket-stage').forEach(bracket => {
        bracket.classList.add('hidden');
    });
    
    document.getElementById(`${currentStage}-bracket`).classList.remove('hidden');
}

function displayMatchesByStage(stage, container) {
    if (!currentTournament || !currentTournament.matches) return;
    
    const stageMatches = currentTournament.matches.filter(match => match.stage === stage);
    container.innerHTML = '';
    
    if (stageMatches.length === 0) {
        container.innerHTML = '<p>No matches scheduled for this stage.</p>';
        return;
    }
    
    stageMatches.forEach(match => {
        const matchElement = document.createElement('div');
        matchElement.className = `tournament-match ${match.completed ? 'completed' : ''}`;
         // Special case for when the same player is on both teams
         if (match.winner === 'special') {
            matchElement.classList.add('special-result');
            matchElement.innerHTML = `
                <div class="match-teams">
                    <div class="team1">${team1Names}</div>
                    <div class="match-vs">vs</div>
                    <div class="team2">${team2Names}</div>
                </div>
                <div class="match-special-result">
                    <p>Special Result: ${match.specialResult}</p>
                </div>
            `;
        } else {
        if (match.winner === 'team1') matchElement.classList.add('team1-win');
        if (match.winner === 'team2') matchElement.classList.add('team2-win');
        
        const team1Names = match.team1Names.join(' & ');
        const team2Names = match.team2Names.join(' & ');
        
        // Check if either team has TBD players or if the match is already completed
        const isTBDMatch = match.team1.includes('TBD') || match.team2.includes('TBD');
        const matchReady = !isTBDMatch && !match.completed;
        
        matchElement.innerHTML = `
            <div class="match-teams">
                <div class="team1">${team1Names}</div>
                <div class="match-vs">vs</div>
                <div class="team2">${team2Names}</div>
            </div>
            <div class="match-score">
                ${match.completed ? `${match.score[0]} - ${match.score[1]}` : ''}
            </div>
            <div class="match-actions">
                ${matchReady ? 
                  `<button class="record-result" data-match-id="${match.id}">Record Result</button>` : ''}
            </div>
        `;
        }
        container.appendChild(matchElement);
    });
    
    // Add event listeners for match result buttons
    container.querySelectorAll('.record-result').forEach(button => {
        button.addEventListener('click', () => {
            const matchId = button.getAttribute('data-match-id');
            openMatchResultModal(matchId);
        });
    });
}

function updateLeaderboard() {
    if (!currentTournament || !currentTournament.standings) return;
    
    // Sort standings by wins (descending)
    const sortedStandings = [...currentTournament.standings].sort((a, b) => {
        // Sort by wins first
        if (b.wins !== a.wins) return b.wins - a.wins;
        // Then by win percentage
        const aWinPct = a.matches > 0 ? a.wins / a.matches : 0;
        const bWinPct = b.matches > 0 ? b.wins / b.matches : 0;
        return bWinPct - aWinPct;
    });
    
    tournamentLeaderboard.innerHTML = `
        <div class="leaderboard-item leaderboard-header">
            <div class="rank">Rank</div>
            <div class="name">Player</div>
            <div class="wins">Wins</div>
            <div class="matches">Matches</div>
        </div>
    `;
    
    sortedStandings.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="rank">${index + 1}</div>
            <div class="name">${player.playerName}</div>
            <div class="wins">${player.wins}</div>
            <div class="matches">${player.matches}</div>
        `;
        tournamentLeaderboard.appendChild(item);
    });
}

function openMatchResultModal(matchId) {
    const match = currentTournament.matches.find(m => m.id === matchId);
    if (!match) return;
    
    currentMatchForResult = match;
    
    // Set teams in modal with selection buttons
    modalMatchTeams.innerHTML = `
        <div class="team-selection">
            <button class="team-select-btn" data-winner="team1">
                <div class="team1">${match.team1Names.join(' & ')}</div>
            </button>
            <div class="match-vs">vs</div>
            <button class="team-select-btn" data-winner="team2">
                <div class="team2">${match.team2Names.join(' & ')}</div>
            </button>
        </div>
        <p class="selection-instructions">Click on the winning team</p>
    `;
    
    // Add event listeners to team selection buttons
    const teamButtons = modalMatchTeams.querySelectorAll('.team-select-btn');
    teamButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove selection from all buttons
            teamButtons.forEach(btn => btn.classList.remove('selected'));
            // Add selection to clicked button
            button.classList.add('selected');
            // Store selected winner
            currentMatchForResult.selectedWinner = button.getAttribute('data-winner');
        });
    });
    
    // Show modal
    matchResultModal.classList.add('show');
    matchResultModal.classList.remove('hidden');
}

async function saveMatchResult() {
    if (!currentMatchForResult || !currentMatchForResult.selectedWinner) {
        alert('Please select a winning team');
        return;
    }
    
    try {
        const winner = currentMatchForResult.selectedWinner;
        
        // Update match in current tournament object
        const matchIndex = currentTournament.matches.findIndex(m => m.id === currentMatchForResult.id);
        currentTournament.matches[matchIndex].winner = winner;
        currentTournament.matches[matchIndex].completed = true;
        // Set a default score (1-0) for display purposes if needed
        currentTournament.matches[matchIndex].score = winner === 'team1' ? [1, 0] : [0, 1];
        
        // Update player standings
        const winningTeam = winner === 'team1' ? currentMatchForResult.team1 : currentMatchForResult.team2;
        
        winningTeam.forEach(playerId => {
            const playerIndex = currentTournament.standings.findIndex(p => p.playerId === playerId);
            if (playerIndex >= 0) {
                currentTournament.standings[playerIndex].wins++;
                currentTournament.standings[playerIndex].matches++;
            }
        });
        
        const losingTeam = winner === 'team1' ? currentMatchForResult.team2 : currentMatchForResult.team1;
        losingTeam.forEach(playerId => {
            const playerIndex = currentTournament.standings.findIndex(p => p.playerId === playerId);
            if (playerIndex >= 0) {
                currentTournament.standings[playerIndex].matches++;
            }
        });
        
        // First UI update to show the match result
        displayActiveTournament();
        
        // Update next match with this match's winners
        updateNextMatch(currentMatchForResult, winner);
        
        // Validate the entire tournament bracket to ensure consistency
        validateTournamentBracket();
        
        // If we're in qualifiers stage and saving a result, make sure semifinals are ready
        if (currentTournament.currentStage === 'qualifiers') {
            ensureSemifinalsReady();
        }
        
        // Check if all matches in current stage are completed
        checkStageCompletion();
        
        // Update tournaments in Firestore
        await setDoc(doc(db, "tournaments", currentTournament.id), currentTournament);
        
        // Final UI update to ensure next matches are shown correctly
        displayActiveTournament();
        
        // Close modal
        matchResultModal.classList.add('hidden');
        currentMatchForResult = null;
        
    } catch (error) {
        console.error("Error saving match result:", error);
        alert('Failed to save match result');
    }
}

function checkStageCompletion() {
    const currentStage = currentTournament.currentStage;
    const stageMatches = currentTournament.matches.filter(match => match.stage === currentStage);
    const allCompleted = stageMatches.every(match => match.completed);
    
    if (allCompleted) {
        if (currentStage === 'qualifiers') {
            advanceToSemifinals();
        } else if (currentStage === 'semifinals') {
            advanceToFinals();
        } else if (currentStage === 'finals') {
            completeTournament();
        }
    }
}

function advanceToSemifinals() {
    // Make sure all qualifier match results are properly propagated to semifinals
    const qualifierMatches = currentTournament.matches.filter(match => 
        match.stage === 'qualifiers' && match.completed);
    
    // For each completed qualifier match, ensure its winner is in the semifinal
    qualifierMatches.forEach(match => {
        const winner = match.winner;
        if (!winner) return; // Skip if no winner (shouldn't happen, but safety check)
        
        // Find the semifinal match this feeds into
        const semifinalMatch = currentTournament.matches.find(m => 
            m.stage === 'semifinals' && m.matchNumber === match.nextMatch);
        
        if (!semifinalMatch) return;
        
        // Get winning team info
        const winningPlayers = winner === 'team1' ? [...match.team1] : [...match.team2];
        const winningNames = winner === 'team1' ? [...match.team1Names] : [...match.team2Names];
        
        // Update semifinal match with winning team
        if (match.nextMatchTeam === 'team1') {
            semifinalMatch.team1 = winningPlayers;
            semifinalMatch.team1Names = winningNames;
        } else {
            semifinalMatch.team2 = winningPlayers;
            semifinalMatch.team2Names = winningNames;
        }
    });
    
    // Now update the stage
    currentTournament.currentStage = 'semifinals';
    
    // Repair and ensure tournaments are ready
    repairTournamentBracket();
    ensureSemifinalsReady();
    
    console.log("Advanced to semifinals, matches:", 
        currentTournament.matches.filter(m => m.stage === 'semifinals'));
}

function advanceToFinals() {
    // Make sure all semifinal match results are properly propagated to finals
    const semifinalMatches = currentTournament.matches.filter(match => 
        match.stage === 'semifinals' && match.completed);
    
    // Get the final match
    const finalMatch = currentTournament.matches.find(m => m.stage === 'finals');
    if (!finalMatch) {
        console.error("Final match not found!");
        return;
    }
    
    console.log("Advancing to finals with semifinal matches:", semifinalMatches);
    
    // For each completed semifinal match, ensure its winner is in the final
    semifinalMatches.forEach(match => {
        const winner = match.winner;
        if (!winner) {
            console.warn(`Semifinal match ${match.id} has no winner!`);
            return;
        }
        
        // Get winning team info
        const winningPlayers = winner === 'team1' ? [...match.team1] : [...match.team2];
        const winningNames = winner === 'team1' ? [...match.team1Names] : [...match.team2Names];
        
        console.log(`Winner of ${match.id}: ${winningNames.join(' & ')} going to ${match.nextMatchTeam} position`);
        
        // Update final match with winning team
        if (match.nextMatchTeam === 'team1') {
            finalMatch.team1 = winningPlayers;
            finalMatch.team1Names = winningNames;
        } else {
            finalMatch.team2 = winningPlayers;
            finalMatch.team2Names = winningNames;
        }
    });
    
    // Now update the stage
    currentTournament.currentStage = 'finals';
    
    // Check for players on both teams
    if (checkFinalsForSamePlayer()) {
        console.log("Detected player(s) on both final teams - tournament automatically completed");
    } else {
        console.log("Advanced to finals, final match:", finalMatch);
    }
}

function completeTournament() {
    // Sort standings by wins (descending), then by win percentage
    const sortedStandings = [...currentTournament.standings]
        .sort((a, b) => {
            // Sort by wins first
            if (b.wins !== a.wins) return b.wins - a.wins;
            // Then by win percentage
            const aWinPct = a.matches > 0 ? a.wins / a.matches : 0;
            const bWinPct = b.matches > 0 ? b.wins / b.matches : 0;
            return bWinPct - aWinPct;
        });
    
    // Get top 3 players (or fewer if not enough players)
    const topThree = sortedStandings.slice(0, Math.min(3, sortedStandings.length));
    
    // Format top players with positions
    const topPlayers = topThree.map((player, index) => ({
        position: index + 1,
        playerId: player.playerId,
        playerName: player.playerName,
        wins: player.wins,
        matches: player.matches
    }));
    
    // Update tournament status
    currentTournament.status = 'completed';
    currentTournament.endDate = serverTimestamp();
    currentTournament.winner = sortedStandings[0].playerName;
    currentTournament.topPlayers = topPlayers; // Add top players array
    
    console.log("Tournament completed! Top 3 players:", topPlayers);
}

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Parse emojis in player names
function convertEmojis(element) {
    if (typeof twemoji !== 'undefined') {
        twemoji.parse(element, {
            folder: 'svg',
            ext: '.svg'
        });
    }
}

function updateNextMatch(match, winner) {
    // Only update next match if this match is part of qualifiers or semifinals
    if (match.stage === 'finals' || !match.nextMatch) return;
    
    // Determine the next stage based on current stage
    const nextStage = match.stage === 'qualifiers' ? 'semifinals' : 'finals';
    
    console.log(`Updating next match: From ${match.stage} match ${match.matchNumber} to ${nextStage} match ${match.nextMatch}`);
    
    // Find the next match this feeds into
    const nextMatch = currentTournament.matches.find(m => 
        m.stage === nextStage && m.matchNumber === match.nextMatch
    );
    
    if (!nextMatch) {
        console.error(`Next match not found: ${nextStage} match ${match.nextMatch}`);
        return;
    }
    
    // Get the winning team info
    const winningPlayers = winner === 'team1' ? [...match.team1] : [...match.team2];
    const winningNames = winner === 'team1' ? [...match.team1Names] : [...match.team2Names];
    
    console.log(`Winner: ${winningNames.join(' & ')} going to ${match.nextMatchTeam} position`);
    
    // Update the appropriate team in the next match
    if (match.nextMatchTeam === 'team1') {
        nextMatch.team1 = winningPlayers;
        nextMatch.team1Names = winningNames;
    } else {
        nextMatch.team2 = winningPlayers;
        nextMatch.team2Names = winningNames;
    }
    
    console.log(`Updated next match: `, nextMatch);
}

function validateTournamentBracket() {
    console.log("Validating tournament bracket...");
    
    // Make sure all completed qualifiers have updated their next matches
    const completedQualifiers = currentTournament.matches.filter(match => 
        match.stage === 'qualifiers' && match.completed);
    
    completedQualifiers.forEach(match => {
        const winner = match.winner;
        if (!winner) return;
        
        // Find the next match this should feed into
        const semifinalMatch = currentTournament.matches.find(m => 
            m.stage === 'semifinals' && m.matchNumber === match.nextMatch);
        
        if (!semifinalMatch) {
            console.warn(`No semifinal match found for qualifier ${match.id}`);
            return;
        }
        
        // Get winning team info
        const winningPlayers = winner === 'team1' ? [...match.team1] : [...match.team2];
        const winningNames = winner === 'team1' ? [...match.team1Names] : [...match.team2Names];
        
        console.log(`Ensuring qualifier ${match.id} winner (${winningNames.join(' & ')}) is in semifinal ${semifinalMatch.id}`);
        
        // Update semifinal match with winning team
        if (match.nextMatchTeam === 'team1') {
            semifinalMatch.team1 = winningPlayers;
            semifinalMatch.team1Names = winningNames;
        } else {
            semifinalMatch.team2 = winningPlayers;
            semifinalMatch.team2Names = winningNames;
        }
    });
    
    // Make sure all completed semifinals have updated the final
    const completedSemifinals = currentTournament.matches.filter(match => 
        match.stage === 'semifinals' && match.completed);
    
    // Get the final match
    const finalMatch = currentTournament.matches.find(m => m.stage === 'finals');
    if (!finalMatch) {
        console.warn("No final match found!");
        return;
    }
    
    completedSemifinals.forEach(match => {
        const winner = match.winner;
        if (!winner) return;
        
        // Get winning team info
        const winningPlayers = winner === 'team1' ? [...match.team1] : [...match.team2];
        const winningNames = winner === 'team1' ? [...match.team1Names] : [...match.team2Names];
        
        console.log(`Ensuring semifinal ${match.id} winner (${winningNames.join(' & ')}) is in final at ${match.nextMatchTeam}`);
        
        // Update final match with winning team
        if (match.nextMatchTeam === 'team1') {
            finalMatch.team1 = winningPlayers;
            finalMatch.team1Names = winningNames;
        } else {
            finalMatch.team2 = winningPlayers;
            finalMatch.team2Names = winningNames;
        }
    });
    
    console.log("Tournament bracket validation complete");
}

// Add this function to ensure all semifinal matches are properly initialized
function ensureSemifinalsReady() {
    console.log("Ensuring semifinals are ready...");
    
    // Get all qualifier matches
    const qualifierMatches = currentTournament.matches.filter(match => 
        match.stage === 'qualifiers');
    
    // Get all semifinal matches
    const semifinalMatches = currentTournament.matches.filter(match => 
        match.stage === 'semifinals');
    
    // Map to track which semifinals have been initialized
    const initializedSemis = new Map();
    semifinalMatches.forEach(match => {
        initializedSemis.set(match.matchNumber, {
            team1Ready: match.team1[0] !== 'TBD',
            team2Ready: match.team2[0] !== 'TBD'
        });
    });
    
    console.log("Before processing: Initialized semifinals:", Object.fromEntries(initializedSemis));
    
    // For each completed qualifier, update its semifinal
    qualifierMatches.filter(match => match.completed).forEach(match => {
        const winner = match.winner;
        if (!winner) return;
        
        const semifinalMatch = semifinalMatches.find(m => m.matchNumber === match.nextMatch);
        if (!semifinalMatch) {
            console.warn(`No semifinal match found for ${match.id}`);
            return;
        }
        
        // Get winning team info
        const winningPlayers = winner === 'team1' ? [...match.team1] : [...match.team2];
        const winningNames = winner === 'team1' ? [...match.team1Names] : [...match.team2Names];
        
        console.log(`Qualifier ${match.id} winner: ${winningNames.join(' & ')} -> Semifinal ${semifinalMatch.id} as ${match.nextMatchTeam}`);
        
        // Update the semifinal match
        if (match.nextMatchTeam === 'team1') {
            semifinalMatch.team1 = winningPlayers;
            semifinalMatch.team1Names = winningNames;
            initializedSemis.get(semifinalMatch.matchNumber).team1Ready = true;
        } else {
            semifinalMatch.team2 = winningPlayers;
            semifinalMatch.team2Names = winningNames;
            initializedSemis.get(semifinalMatch.matchNumber).team2Ready = true;
        }
    });
    
    // Fall-back: If there are still uninitialized teams and we have unassigned
    // players, assign them to fill the TBD spots
    initializedSemis.forEach((status, semifinalNumber) => {
        const semifinal = semifinalMatches.find(m => m.matchNumber === semifinalNumber);
        if (!semifinal) return;
        
        // Check if we need to auto-populate team 1
        if (!status.team1Ready) {
            console.log(`Auto-populating team1 for semifinal ${semifinalNumber}`);
            
            // Find first qualifier that feeds into this semifinal position
            const qualifierForTeam1 = qualifierMatches.find(q => 
                q.nextMatch === semifinalNumber && q.nextMatchTeam === 'team1');
            
            if (qualifierForTeam1) {
                // Just use team1 from the qualifier
                semifinal.team1 = [...qualifierForTeam1.team1];
                semifinal.team1Names = [...qualifierForTeam1.team1Names];
                status.team1Ready = true;
            }
        }
        
        // Check if we need to auto-populate team 2
        if (!status.team2Ready) {
            console.log(`Auto-populating team2 for semifinal ${semifinalNumber}`);
            
            // Find first qualifier that feeds into this semifinal position
            const qualifierForTeam2 = qualifierMatches.find(q => 
                q.nextMatch === semifinalNumber && q.nextMatchTeam === 'team2');
            
            if (qualifierForTeam2) {
                // Just use team1 from the qualifier
                semifinal.team2 = [...qualifierForTeam2.team1];
                semifinal.team2Names = [...qualifierForTeam2.team1Names];
                status.team2Ready = true;
            }
        }
    });
    
    console.log("After processing: Initialized semifinals:", Object.fromEntries(initializedSemis));
    
    // Check if any semifinal is not fully initialized
    let allSemisReady = true;
    initializedSemis.forEach((status, matchNumber) => {
        if (!status.team1Ready || !status.team2Ready) {
            allSemisReady = false;
            console.warn(`Semifinal ${matchNumber} not fully initialized: Team1=${status.team1Ready}, Team2=${status.team2Ready}`);
        }
    });
    
    return allSemisReady;
}

function debugMatchProgression() {
    console.log("==== MATCH PROGRESSION DEBUG ====");
    
    const qualifierMatches = currentTournament.matches.filter(m => m.stage === 'qualifiers');
    const semifinalMatches = currentTournament.matches.filter(m => m.stage === 'semifinals');
    
    console.log(`Found ${qualifierMatches.length} qualifiers feeding into ${semifinalMatches.length} semifinals`);
    
    // Check qualifier → semifinal connections
    qualifierMatches.forEach(match => {
        console.log(`Qualifier ${match.matchNumber} (${match.id}) → Semifinal ${match.nextMatch} as ${match.nextMatchTeam}`);
        
        // Verify the target semifinal exists
        const target = semifinalMatches.find(m => m.matchNumber === match.nextMatch);
        if (!target) {
            console.error(`ERROR: Target semifinal ${match.nextMatch} doesn't exist!`);
        }
    });
    
    // Check if all semifinals have inputs
    semifinalMatches.forEach(match => {
        const feedingQualifiers = qualifierMatches.filter(q => q.nextMatch === match.matchNumber);
        const team1Sources = feedingQualifiers.filter(q => q.nextMatchTeam === 'team1');
        const team2Sources = feedingQualifiers.filter(q => q.nextMatchTeam === 'team2');
        
        console.log(`Semifinal ${match.matchNumber} (${match.id}):`);
        console.log(`  - Team1 fed by: ${team1Sources.map(q => q.id).join(', ') || 'NONE'}`);
        console.log(`  - Team2 fed by: ${team2Sources.map(q => q.id).join(', ') || 'NONE'}`);
    });
    
    console.log("================================");
}

function repairTournamentBracket() {
    // First debug the current state
    debugMatchProgression();
    
    // Get all stages
    const qualifiers = currentTournament.matches.filter(m => m.stage === 'qualifiers');
    const semifinals = currentTournament.matches.filter(m => m.stage === 'semifinals');
    const finals = currentTournament.matches.filter(m => m.stage === 'finals');
    
    console.log("Attempting to repair tournament bracket...");
    
    // Step 1: Make sure each semifinal has both team assignments
    for (let semifinal of semifinals) {
        // Find all qualifiers feeding into this semifinal
        const feedingQualifiers = qualifiers.filter(q => q.nextMatch === semifinal.matchNumber);
        
        // Check team1 assignment
        const team1Qualifiers = feedingQualifiers.filter(q => q.nextMatchTeam === 'team1');
        if (team1Qualifiers.length === 0) {
            console.warn(`Semifinal ${semifinal.matchNumber} has no team1 assignment`);
            // Find a completed qualifier to use
            const completedQualifier = qualifiers.find(q => q.completed && q.nextMatchTeam !== 'team1');
            if (completedQualifier) {
                console.log(`Fixing: Assigning ${completedQualifier.id} to semifinal ${semifinal.matchNumber} team1`);
                completedQualifier.nextMatch = semifinal.matchNumber;
                completedQualifier.nextMatchTeam = 'team1';
                // Update semifinal with this qualifier's winner
                if (completedQualifier.winner) {
                    const winner = completedQualifier.winner;
                    const players = winner === 'team1' ? completedQualifier.team1 : completedQualifier.team2;
                    const names = winner === 'team1' ? completedQualifier.team1Names : completedQualifier.team2Names;
                    semifinal.team1 = players;
                    semifinal.team1Names = names;
                }
            }
        }
        
        // Check team2 assignment
        const team2Qualifiers = feedingQualifiers.filter(q => q.nextMatchTeam === 'team2');
        if (team2Qualifiers.length === 0) {
            console.warn(`Semifinal ${semifinal.matchNumber} has no team2 assignment`);
            // Find a completed qualifier to use
            const completedQualifier = qualifiers.find(q => q.completed && q.nextMatchTeam !== 'team2');
            if (completedQualifier) {
                console.log(`Fixing: Assigning ${completedQualifier.id} to semifinal ${semifinal.matchNumber} team2`);
                completedQualifier.nextMatch = semifinal.matchNumber;
                completedQualifier.nextMatchTeam = 'team2';
                // Update semifinal with this qualifier's winner
                if (completedQualifier.winner) {
                    const winner = completedQualifier.winner;
                    const players = winner === 'team1' ? completedQualifier.team1 : completedQualifier.team2;
                    const names = winner === 'team1' ? completedQualifier.team1Names : completedQualifier.team2Names;
                    semifinal.team2 = players;
                    semifinal.team2Names = names;
                }
            }
        }
    }
    
    // Step 2: Make sure the finals have inputs from all semifinals
    if (finals.length > 0) {
        const finalMatch = finals[0];
        semifinals.forEach((semi, index) => {
            semi.nextMatch = finalMatch.matchNumber;
            semi.nextMatchTeam = index % 2 === 0 ? 'team1' : 'team2';
            
            // If this semifinal is complete, update the final
            if (semi.completed && semi.winner) {
                const winner = semi.winner;
                const players = winner === 'team1' ? semi.team1 : semi.team2;
                const names = winner === 'team1' ? semi.team1Names : semi.team2Names;
                
                if (semi.nextMatchTeam === 'team1') {
                    finalMatch.team1 = players;
                    finalMatch.team1Names = names;
                } else {
                    finalMatch.team2 = players;
                    finalMatch.team2Names = names;
                }
            }
        });
    }
    
    // Debug the repaired state
    debugMatchProgression();
    console.log("Tournament bracket repair complete");
}

function checkFinalsForSamePlayer() {
    if (currentTournament.currentStage !== 'finals') return false;
    
    const finalMatch = currentTournament.matches.find(m => m.stage === 'finals');
    if (!finalMatch) return false;
    
    // Check if there are any players that appear on both teams
    const overlappingPlayers = finalMatch.team1.filter(playerId => 
        finalMatch.team2.includes(playerId)
    );
    
    if (overlappingPlayers.length > 0) {
        console.log("Detected player(s) on both final teams:", overlappingPlayers);
        
        // Get the player names for display
        const winnerNames = overlappingPlayers.map(playerId => {
            const player = currentTournament.players.find(p => p.id === playerId);
            return player ? player.name : 'Unknown Player';
        });
        
        // Mark these players as tournament champions
        completeTournamentWithOverlappingWinners(overlappingPlayers, winnerNames);
        
        return true;
    }
    
    return false;
}

function completeTournamentWithOverlappingWinners(winnerIds, winnerNames) {
    // Sort standings to determine 2nd and 3rd place
    const sortedStandings = [...currentTournament.standings]
        .sort((a, b) => {
            // Sort by wins first
            if (b.wins !== a.wins) return b.wins - a.wins;
            // Then by win percentage
            const aWinPct = a.matches > 0 ? a.wins / a.matches : 0;
            const bWinPct = b.matches > 0 ? b.wins / b.matches : 0;
            return bWinPct - aWinPct;
        });
    
    // Create top players list, starting with our special winners
    const topPlayers = [];
    
    // Add the special winners as first place
    winnerIds.forEach(playerId => {
        const player = currentTournament.standings.find(p => p.playerId === playerId);
        if (player) {
            topPlayers.push({
                position: 1,
                playerId: player.playerId,
                playerName: player.playerName,
                wins: player.wins,
                matches: player.matches
            });
        }
    });
    
    // Add 2nd and 3rd place players (excluding the winners)
    let position = 2;
    for (const player of sortedStandings) {
        if (!winnerIds.includes(player.playerId) && position <= 3) {
            topPlayers.push({
                position: position,
                playerId: player.playerId,
                playerName: player.playerName,
                wins: player.wins,
                matches: player.matches
            });
            position++;
            
            if (position > 3) break; // Stop after adding 3rd place
        }
    }
    
    // Update tournament status
    currentTournament.status = 'completed';
    currentTournament.endDate = serverTimestamp();
    currentTournament.winner = winnerNames.length > 1 
        ? `${winnerNames.join(' & ')} (Co-champions)` 
        : winnerNames[0];
    currentTournament.topPlayers = topPlayers;
    
    // Also mark the final match as a special case
    const finalMatch = currentTournament.matches.find(m => m.stage === 'finals');
    if (finalMatch) {
        finalMatch.completed = true;
        finalMatch.winner = 'special';
        finalMatch.specialResult = `${winnerNames.join(' & ')} appeared on both teams`;
    }
    
    console.log(`Tournament completed with special result! Top players:`, topPlayers);
}