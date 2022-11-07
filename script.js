// Populate squares
const field = document.getElementById("field");
for (let i=0; i<42; i++) {
  const square = document.createElement("div");
  square.id = "square" + i;
  field.appendChild(square)
}

// Print board
function print(brd) {
  for (let i=0; i<42; i++) {
    const square = document.getElementById("square" + i);
    square.setAttribute("class", "color"+brd[i]);
    square.classList.add("square");
  }
}

// Get square selection
function select() {
  return new Promise(function(resolve) {
    function highlight(event) {
      document.removeEventListener("mousedown", highlight)
      const square = document.getElementById(event.target.id.replace("piece", "square"));
      if (!square) {
        resolve(null);
        return;
      }
      if (!square.id.includes("square")) {
        resolve(null);
        return;
      }
      const squares = document.getElementsByClassName("square");
      for (let i=0; i<squares.length; i++) {
        const element = squares[i];
        if (element.classList.contains("highlighted")) {
          element.classList.remove("highlighted");
          resolve(square.id);
          return;
        }
      }
      square.classList.add("highlighted");
      resolve(square.id);
      return;
    }
    document.addEventListener("mousedown", highlight);
  });
}

// Zobrist hashing
let zobrist = new Array(42);
for (let i=0; i<42; i++) {
  zobrist[i] = Math.floor(Math.random()*1e14);
}

// Current position, including search 
class Position {
  constructor(brd, score, hash) {
    this.brd = brd;
    this.score = score;
    this.hash = hash;
  }
  moves() {
    let moves = [];
    for (let i=0; i<7; i++) { if (this.brd[i] == 0) moves.push(i); }
    return moves;
  }
  update(mv) {
    let cbrd = [...this.brd];
    let cscore = this.score;
    let pc;
    for (let i=0; i<6; i++) {
      if (!cbrd[35+mv-7*i]) {
        cbrd[35+mv-7*i] = 1;
        pc = 35+mv-7*i;
        break;
      }
    }
    const directions = [1, 6, 7, 8];
    const sidestep = [1, -1, 0, 1];
    for (let i=0; i<directions.length; i++) {
      const dir = directions[i];
      const step = sidestep[i];
      let line = 1;
      let positive = true;
      let negative = true;
      for (let len=1; len<4; len++) {
        if (positive&&cbrd[pc+dir*len]==1&&(pc+dir*len)%7==pc%7+step*len) {
          line++;
        } else {
          if (positive&&cbrd[pc+dir*len]==0&&(pc+dir*len)%7==pc%7+step*len) {
            cscore += 40*line;
          }
          positive = false;
        }
        if (negative&&cbrd[pc-dir*len]==1&&(pc-dir*len)%7==pc%7-step*len) {
          line++;
        } else {
          if (positive&&cbrd[pc+dir*len]==0&&(pc+dir*len)%7==pc%7+step*len) {
            cscore += 40*line;
            // if (line==3&&cbrd.reduce((p,c)=>p+c?0:1,0)%2==Math.floor((pc+dir*len)/7+1)%2) {
            //   cscore += 100;
            // }
          }
          negative = false;
        }
        if (!positive&&!negative||line>=4) {
          break;
        }
      }
      if (line>=4) {
        cscore = 1000;
        break;
      }
    }
    return new Position(cbrd.map(x=>-x), -cscore, -this.hash-zobrist[pc]);
  }
  flip() {
    return new Position(this.brd.map(x=>-x), -this.score, -this.hash);
  }
  best(limit, verbose=true) {
    let start = Date.now();
    this.transpos = {};
    let evals = [];
    let moves = this.moves();
    let deepest = 0;
    for (let depth=1; depth<51; depth++) {
      deepest = depth;
      evals = [];
      let alpha = -Infinity;
      let beta = Infinity;
      for (let mv of moves) {
        const next = -this.evaluate(this.update(mv), depth-1, -beta, -alpha);
        evals.push(next)
        alpha = Math.max(alpha, next);
      }
      if (limit<Date.now()-start) break;
    }
    if (verbose) {
      console.log("Depth searched: " + deepest);
      console.log("Evaluation: " + Math.max(...evals));
    }
    return moves[evals.indexOf(Math.max(...evals))];
  }
  evaluate(pos, depth, alpha, beta) {
    const hash = pos.hash+depth
    if (hash in this.transpos) return this.transpos[hash];
    if (!depth||pos.score==-1000) {
      this.transpos[hash] = pos.score-depth;
      return pos.score-depth;
    }
    let moves = pos.moves();
    if (!moves.length) {
      this.transpos[pos.hash] = 0;
      return 0;
    }
    for (let mv of moves) {
      alpha = Math.max(alpha, -this.evaluate(pos.update(mv), depth-1, -beta, -alpha));
      if (beta<=alpha) break;
    }
    this.transpos[hash] = alpha;
    return alpha;
  }
}


class Game {
  constructor(player, time) {
    this.player = player;
    this.time = time;
    this.pos = new Position(new Array(42).fill(0), 0, 0);
  }
  async play() {
    if (this.player-1) this.pos = this.pos.update(3);
    print(this.pos.brd);
    let running = true;
    while (running) {
      const playermove = await this.playermove();
      this.pos = this.pos.update(playermove);
      print(this.pos.flip().brd);
      if (this.pos.score==-1000) {
        document.getElementById("message").innerHTML = "Player Wins!";
        running = false;
        continue;
      }
      if (!this.pos.moves().length) {
        document.getElementById("message").innerHTML = "Draw";
        running = false;
        continue;
      }
      const computermove = this.pos.best(this.time);
      this.pos = this.pos.update(computermove);
      print(this.pos.brd);
      if (this.pos.score==-1000) {
        document.getElementById("message").innerHTML = "Computer Wins!";
        running = false;
        continue;
      }
      if (!this.pos.moves().length) {
        document.getElementById("message").innerHTML = "Draw";
        running = false;
        continue;
      }
    }
  }
  async playermove() {
    let illegal = true;
    let move;
    while (illegal) {
      move = null;
      while (move === null) {
        move = await select();
      }
      move = parseInt(move.replace("square", "")%7);
      if (this.pos.moves().includes(move)) illegal = false;
    }
    return move;
  }
}

connect4 = new Game(1, 200);

connect4.play()
