const fs = require('fs');

// 1. Fix app/page.tsx
let page = fs.readFileSync('app/page.tsx', 'utf8');
page = page.replace('tournaments.map((t, index) =>', 'tournaments.filter(t => t !== null).map((t, index) =>');
fs.writeFileSync('app/page.tsx', page);

// 2. Fix manage/general/page.tsx
let general = fs.readFileSync('app/t/[tournamentId]/manage/general/page.tsx', 'utf8');
general = general.replace(/sport,\s*/g, ''); 
fs.writeFileSync('app/t/[tournamentId]/manage/general/page.tsx', general);

// 3. Fix manage/players/page.tsx
let players = fs.readFileSync('app/t/[tournamentId]/manage/players/page.tsx', 'utf8');
players = players.replace('id: id as Id<"players">', 'playerId: id as Id<"players">');
fs.writeFileSync('app/t/[tournamentId]/manage/players/page.tsx', players);

// 4. Fix manage/structure/[phaseId]/page.tsx
let phaseIdPage = fs.readFileSync('app/t/[tournamentId]/manage/structure/[phaseId]/page.tsx', 'utf8');
phaseIdPage = phaseIdPage.replace(/playerId: pid,/g, 'playerId: pid as Id<"players">,');
fs.writeFileSync('app/t/[tournamentId]/manage/structure/[phaseId]/page.tsx', phaseIdPage);

// 5. Fix manage/structure/page.tsx
let structure = fs.readFileSync('app/t/[tournamentId]/manage/structure/page.tsx', 'utf8');
if (!structure.includes('import Link')) {
  structure = 'import Link from "next/link";\n' + structure;
}
structure = structure.replace('id: id as Id<"phases">, adminToken', 'phaseId: id as Id<"phases">, tournamentId: tournamentId as Id<"tournaments">, adminToken');
fs.writeFileSync('app/t/[tournamentId]/manage/structure/page.tsx', structure);

// 6. Fix player/[playerToken]/page.tsx
let playerTokenPage = fs.readFileSync('app/t/[tournamentId]/player/[playerToken]/page.tsx', 'utf8');
playerTokenPage = playerTokenPage.replace('matches.length === 0', '(matches || []).length === 0');
playerTokenPage = playerTokenPage.replace('matches.map', '(matches || []).map');
fs.writeFileSync('app/t/[tournamentId]/player/[playerToken]/page.tsx', playerTokenPage);

console.log('Fixed all TS errors.');
