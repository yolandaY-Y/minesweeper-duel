# Minesweeper Duel

Two players race on a shared minefield. A deliberately opened safe square earns one point. Opening a bomb costs one point, exposes the bomb to both players and freezes only the player who hit it. Scores can go below zero. The neutral starting area and automatic reveals earn no points.

Right-click, or select Flag and tap, to place or remove a private flag. You can flag as many covered squares as you like. Flags stay in the browser that placed them and are always worth zero points. A flag prevents its owner from directly opening the square. The opponent can open it, and either player's automatic reveals can uncover it. Revealing a flagged square clears its flag.

The host can choose Easy (8×8, 6 mines), Standard (9×9, 12 mines), Hard (16×16, 40 mines), or set the columns (5–30), rows (5–24), and mine count for a custom board. Nine starting clues and at least one playable safe square must fit. Round time can be 1–3,600 seconds (default 90) and a bomb freeze can be 1–30 seconds (default 5). Settings can change before a rematch.

Play ends when all safe squares are open or the clock expires. The higher total wins and equal totals tie. Each player sees the accuracy of their own remaining flags when the round ends.

## Play

For two devices, open the same hosted HTTPS game URL on both. One player selects **Create room** and shares the six-digit code. The other enters the code and selects **Join room**. The host then selects **Start duel**. Online rooms use PeerJS Cloud for signaling.

To practice in two tabs, append `?practice=1` to the game URL. For example, run `python3 -m http.server 8000` in this directory and open `http://localhost:8000/?practice=1`. Create a room and select **Open player 2 in a new tab**. Join in that tab, then start in the first. Practice works locally without the signaling service. Run `node --test` to check the duel rules and room behavior.

Left-click to open and right-click to flag. The **Flag** button also works with a trackpad, touchscreen, or keyboard. Player 1 hosts the board and settles moves in arrival order. Both players see identical claims, scores and results. Player 1 can start a rematch.

## Source

Adapted from [MineDuo by Ethan Hawksley](https://github.com/ethanhawksley/mineduo) under the included MIT license. The original game is available at `classic.html`.
