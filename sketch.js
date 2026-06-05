let capture;
let poseNet;
let noseX = -1;
let noseY = -1;
let bgImg; // 背景圖片變數
let bgScrollX = 0; // 背景捲動位置
let midImg, upImg, downImg, noseFinalImg;
let eagleMidImg, eagleUpImg, eagleDownImg;
let eagleImg; // 目前顯示的老鷹圖片
let noseImg; // 目前顯示的圖片
let gameState = 'start'; // 遊戲狀態：'start' 或 'playing'
let baselineY = -1; // 玩家一開始的 Y 座標基準
let nameInput; // 名字輸入框
let fadeAlpha = 0; // 控制轉場遮罩的透明度
let isTransitioning = false; // 是否處於轉場狀態
let obstacles = []; // 儲存障礙物長方形
let isGameOver = false; // 遊戲是否結束（停止滾動）
let countdownStartTime = 0; // 紀錄倒數開始的時間
let score = 0; // 躲過的障礙物數量
let survivalTime = 0; // 生存秒數
let playStartTime = 0; // 進入 playing 狀態的時間點
let highScore = 0; // 歷史最高分
let leaderboard = []; // 排行榜陣列
let bgLerpAmount = 0; // 背景顏色漸變比例 (0 ~ 1)
let difficultyWarningStart = 0; // 難度警告開始時間
let hitObstacle = null; // 紀錄碰撞到的障礙物

function preload() {
  // 載入不同狀態的圖片
  midImg = loadImage('圖片/中.png');
  upImg = loadImage('圖片/上.png');
  downImg = loadImage('圖片/下.png');
  noseFinalImg = loadImage('圖片/鼻子.png');
  eagleMidImg = loadImage('圖片/老鷹中.png');
  eagleUpImg = loadImage('圖片/老鷹上.png');
  eagleDownImg = loadImage('圖片/老鷹下.png');
  eagleImg = eagleMidImg;
  noseImg = midImg; // 初始預設為中
  // 載入背景圖片 (請確保副檔名正確，例如 .png 或 .jpg)
  bgImg = loadImage('圖片/背景.png');
}

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);

  initObstacles();
  // 從瀏覽器讀取最高分紀錄
  highScore = parseInt(localStorage.getItem('p5_highScore')) || 0;
  // 讀取排行榜紀錄
  leaderboard = JSON.parse(localStorage.getItem('p5_leaderboard')) || [];

  // 建立名字輸入框
  nameInput = createInput('玩家');
  nameInput.size(160);
  nameInput.style('font-size', '18px');
  nameInput.attribute('maxlength', '5'); // 限制最多輸入 5 個字
  nameInput.style('text-align', 'center');
  nameInput.style('padding', '5px');
  nameInput.style('border-radius', '5px');
  updateInputPosition();

  // 擷取攝影機影像
  capture = createCapture(VIDEO);
  capture.size(640, 480); // 設定固定解析度以維持辨識準確度
  // 隱藏預設的 HTML5 影片元件，只在畫布上繪製
  capture.hide();

  // 初始化 PoseNet 模型
  poseNet = ml5.poseNet(capture, () => console.log('PoseNet 模型已載入'));
  // 監聽辨識結果，更新鼻尖位置
  poseNet.on('pose', (poses) => {
    if (poses.length > 0) {
      let newNoseX = poses[0].pose.nose.x;
      let newNoseY = poses[0].pose.nose.y;

      // 當進入倒數或遊戲狀態後，捕捉初始位置作為基準點
      if (gameState === 'playing' || gameState === 'countdown') {
        if (baselineY === -1) {
          baselineY = newNoseY;
        }

        let threshold = 30; // 判定範圍（像素），可調整此數值來改變靈敏度
        let diff = newNoseY - baselineY;

        if (diff < -threshold) {
          noseImg = upImg;      // 座標變小代表向上
          eagleImg = eagleUpImg;
        } else if (diff > threshold) {
          noseImg = downImg;    // 座標變大代表向下
          eagleImg = eagleDownImg;
        } else {
          noseImg = midImg;     // 在基準點附近則顯示中間
          eagleImg = eagleMidImg;
        }
      }

      noseX = newNoseX;
      noseY = newNoseY;
    }
  });
}

function initObstacles() {
  obstacles = [];
  let spacing = 350; // 長條形之間的水平間距
  let imgW = width * 0.8;
  for (let i = 0; i < 5; i++) {
    obstacles.push({
      // 在 scale(-1, 1) 下，負值代表視覺右側。從右側外開始排列。
      x: -imgW / 2 - i * spacing,
      h: random(100, height * 0.48), // 根據 80% 影像高度隨機
      w: 80,
      speed: 3,
      isTop: i % 2 === 0,
      color: [0, 0, 0] // 初始顏色設為黑色
    });
  }
  score = 0;
  survivalTime = 0;
  isGameOver = false;
  bgLerpAmount = 0; // 重置漸變比例
  difficultyWarningStart = 0; // 重置警告
  hitObstacle = null; // 重置碰撞紀錄
}

function draw() {
  if (gameState === 'start') {
    // --- 開始畫面 ---
    drawScrollingBackground();

    nameInput.show(); // 顯示輸入框
    let baseW = 250;
    let baseH = 60;

    // 在開始遊戲按鈕上方加入提示文字
    fill(255);
    textSize(16);
    textAlign(CENTER, CENTER);
    text('請躲避飛行路上突然出現的障礙物', width / 2, height / 2 - 110);

    // --- 開始遊戲按鈕 (位置稍微上移) ---
    let startY = height / 2 - 60;
    let isStartHover = mouseX > width / 2 - baseW / 2 && mouseX < width / 2 + baseW / 2 &&
                       mouseY > startY - baseH / 2 && mouseY < startY + baseH / 2;

    rectMode(CENTER);
    if (isStartHover) {
      fill('#e7c6ff'); // 懸停時變色
      rect(width / 2, startY, baseW * 1.1, baseH * 1.1, 10);
    } else {
      fill(255); // 預設白色
      rect(width / 2, startY, baseW, baseH, 10);
    }

    // --- 排行榜按鈕 ---
    let lbY = height / 2 + 20;
    let isLbHover = mouseX > width / 2 - baseW / 2 && mouseX < width / 2 + baseW / 2 &&
                    mouseY > lbY - baseH / 2 && mouseY < lbY + baseH / 2;

    if (isLbHover) {
      fill('#bde0fe'); // 不同的懸停顏色
      rect(width / 2, lbY, baseW * 1.1, baseH * 1.1, 10);
    } else {
      fill(200); // 淺灰色
      rect(width / 2, lbY, baseW, baseH, 10);
    }

    // 繪製按鈕文字
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(isStartHover ? 26 : 24);
    if (frameCount % 60 < 30 || isStartHover) {
      text('開始遊戲', width / 2, startY);
    }
    textSize(isLbHover ? 26 : 24);
    text('查看排行榜', width / 2, lbY);

    // 繪製暱稱提示 (位置下移)
    fill(255);
    textSize(18);
    text('輸入你的暱稱:', width / 2, height / 2 + 95);

    // --- 繪製操作指南圖示 (右下角) ---
    push();
    // 移至右下角座標
    translate(width - 120, height - 110);
    rectMode(CENTER);
    
    // 繪製半透明裝飾框
    fill(255, 30);
    noStroke();
    rect(0, 0, 160, 140, 15);
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text('操作指南', 0, -50);
    
    // 繪製簡單的頭部與箭頭示意圖
    stroke(255);
    strokeWeight(2);
    noFill();
    ellipse(0, 0, 25, 25); // 代表頭部
    line(0, -15, 0, -30);  // 向上箭頭
    triangle(-5, -30, 5, -30, 0, -38);
    line(0, 15, 0, 30);   // 向下箭頭
    triangle(-5, 30, 5, 30, 0, 38);
    
    noStroke();
    textSize(12);
    text('上下移動頭部控制', 0, 55);
    pop();

    // 轉場邏輯：點擊後增加透明度
    if (isTransitioning) {
      fadeAlpha += 10;
      if (fadeAlpha >= 255) {
        fadeAlpha = 255;
        gameState = 'countdown';
        countdownStartTime = millis(); // 開始倒數計時
      }
    }
  } else if (gameState === 'leaderboard') {
    // --- 排行榜畫面 ---
    drawScrollingBackground();
    nameInput.hide();

    fill(255, 215, 0); // 金色
    textSize(50);
    textAlign(CENTER, CENTER);
    text('🏆 英雄榜 🏆', width / 2, height / 2 - 150);

    fill(255);
    textSize(24);
    for (let i = 0; i < leaderboard.length; i++) {
      let yPos = height / 2 - 60 + (i * 40);
      let entry = leaderboard[i];
      let name = typeof entry === 'object' ? entry.name : "未知玩家";
      let val = typeof entry === 'object' ? entry.score : entry;
      textAlign(LEFT, CENTER);
      text(`${i + 1}. ${name}`, width / 2 - 120, yPos);
      textAlign(RIGHT, CENTER);
      text(`${val} 分`, width / 2 + 120, yPos);
    }

    // 返回按鈕
    let backW = 150, backH = 50;
    let backY = height / 2 + 180;
    let isBackHover = mouseX > width / 2 - backW / 2 && mouseX < width / 2 + backW / 2 &&
                      mouseY > backY - backH / 2 && mouseY < backY + backH / 2;
    
    rectMode(CENTER);
    if (isBackHover) {
      fill('#ffafcc');
      rect(width / 2, backY, backW * 1.1, backH * 1.1, 10);
    } else {
      fill(255);
      rect(width / 2, backY, backW, backH, 10);
    }
    
    fill(0);
    textSize(20);
    textAlign(CENTER, CENTER);
    text('返回主選單', width / 2, backY);
  } else if (gameState === 'countdown' || gameState === 'playing') {
    // --- 影像顯示畫面 ---
    nameInput.hide(); // 進入遊戲後隱藏輸入框
    drawScrollingBackground();

    push();
    // 將原點移動到畫布中心
    translate(width / 2, height / 2);
    // 左右顛倒影像 (鏡像效果)
    scale(-1, 1);
    // 設定圖片繪製模式為中心
    imageMode(CENTER);
    
    let imgW = width * 0.8;
    let imgH = height * 0.8;

    // 繪製影像，大小為全螢幕寬高的 80%
    image(capture, 0, 0, imgW, imgH);

    // --- 繪製並更新長方形障礙物 ---
    for (let obs of obstacles) {
      let c = obs.color || [0, 0, 0];
      // 根據位置決定樣式：進入畫面內為黑色，在畫面外(右側)則為半透明灰色作為預告
      if (obs.x < -imgW / 2) {
        fill(c[0], c[1], c[2], 80); // 使用物件顏色，並設為半透明預覽
        stroke(255, 150); // 加上淡白色外框讓預覽更明顯
        strokeWeight(2);
      } else {
        fill(c[0], c[1], c[2]); // 使用障礙物儲存的顏色
        noStroke();
      }

      // --- 碰撞閃爍特效 ---
      // 如果遊戲結束且目前處理的是碰撞到的那個障礙物
      if (isGameOver && obs === hitObstacle) {
        if (frameCount % 20 < 10) { // 每 10 幀切換一次顏色
          fill(255, 255, 255); // 閃爍為白色
          stroke(255, 0, 0);   // 紅色邊框
          strokeWeight(5);
        }
      }

      rectMode(CORNER);
      let obsY = obs.isTop ? -imgH / 2 : imgH / 2 - obs.h;
      rect(obs.x, obsY, obs.w, obs.h);

      // 如果遊戲未結束且已正式開始，則由右至左移動，速度隨得分增加
      if (!isGameOver && gameState === 'playing') {
        // 計算目前速度：基礎速度(3) + 每個得分加成(0.2)
        let currentSpeed = obs.speed + (score * 0.2);
        // 在 scale(-1, 1) 下，x 增加代表視覺上由右往左移
        obs.x += currentSpeed; 

        // 當長方形完全移出視覺左側（x 座標大於 imgW/2）時回收
        if (obs.x > imgW / 2) {
          score++; // 成功躲過一個，分數加1
          // 分數達到 15 分時觸發警告
          if (score === 15) {
            difficultyWarningStart = millis();
          }
          // 找出目前所有障礙物中最右邊（x 最小）的一個
          let farX = imgW / 2;
          for (let other of obstacles) {
            if (other.x < farX) farX = other.x;
          }
          // 將回收的長方形放到最後面（最右側），並加上間距
          // 分數達到 15 分時，縮小基礎間距與增長係數，讓長條形變得密集
          let spacingBase = score >= 15 ? 250 : 350;
          let spacingIncr = score >= 15 ? 2 : 5;
          obs.x = farX - (spacingBase + score * spacingIncr);
          obs.h = random(100, imgH * 0.6); // 重新設定隨機長度

          // 分數超過 25 分時，賦予隨機顏色 (為了讓顏色明顯，RGB 範圍設在 100-255)
          if (score > 25) {
            obs.color = [random(100, 255), random(100, 255), random(100, 255)];
          } else {
            obs.color = [0, 0, 0];
          }
          // 保持原本的 isTop 屬性即可維持交錯感
        }
      }
    }

    // 更新生存時間（僅在遊戲進行中且未結束時計算）
    if (gameState === 'playing' && !isGameOver) {
      survivalTime = (millis() - playStartTime) / 1000;
    }

    // 如果偵測到鼻尖，則在對應位置顯示圖片
    if (noseX !== -1) {
      // 將 PoseNet 原始座標映射到畫布中央顯示影像的比例範圍內
      let x = map(noseX, 0, capture.width, -imgW / 2, imgW / 2);
      let y = map(noseY, 0, capture.height, -imgH / 2, imgH / 2);

      // 碰撞偵測邏輯
      if (!isGameOver && gameState === 'playing') {
        for (let obs of obstacles) {
          let obsY = obs.isTop ? -imgH / 2 : imgH / 2 - obs.h;
          // 以鼻尖單點 (x, y) 為準進行碰撞判定
          if (x > obs.x && x < obs.x + obs.w &&
              y > obsY && y < obsY + obs.h) {
            isGameOver = true; // 碰到長方形，停止滾動
            hitObstacle = obs; // 紀錄被碰撞的障礙物
            // 檢查並更新最高分
            if (score > highScore) {
              highScore = score;
              localStorage.setItem('p5_highScore', highScore);
            }
            
            // 取得玩家名稱（若空白則顯示匿名）
            let playerName = nameInput.value().trim() || "匿名玩家";
            
            // 尋找是否已有相同名字的紀錄 (排除舊版純數字格式)
            let existingEntry = leaderboard.find(entry => typeof entry === 'object' && entry.name === playerName);
            
            if (existingEntry) {
              // 若存在相同名字，則更新為較高的分數
              if (score > existingEntry.score) {
                existingEntry.score = score;
              }
            } else {
              // 若無相同名字，則新增紀錄
              leaderboard.push({ name: playerName, score: score });
            }
            
            // 排序：確保不管是物件還是舊版純數字都能正確由大到小排序
            leaderboard.sort((a, b) => {
              let scoreA = typeof a === 'object' ? a.score : a;
              let scoreB = typeof b === 'object' ? b.score : b;
              return scoreB - scoreA;
            });

            leaderboard = leaderboard.slice(0, 5); // 只保留前五名
            localStorage.setItem('p5_leaderboard', JSON.stringify(leaderboard));
          }
        }
      }

      // 根據分數改變角色外觀
      if (score >= 30) {
        // 分數達到 30 分，顯示老鷹系列圖片（根據動作切換）
        image(eagleImg, x, y, 100, 100);
      } else if (score >= 20) {
        // 分數達到 20 分，顯示最後的鼻子圖片
        image(noseFinalImg, x, y, 100, 100);
      } else if (score >= 10) {
        // 分數在 10-19 分之間，顯示紅點
        fill(255, 0, 0); // 純紅色
        noStroke();
        ellipse(x, y, 30, 30); // 繪製直徑為 30 的圓點
      } else {
        // 分數低於 10 分，顯示原本的圖片
        image(noseImg, x, y, 100, 100);
      }
    }
    pop();

    // --- 倒數計時文字顯示 ---
    if (gameState === 'countdown') {
      let elapsed = millis() - countdownStartTime;
      let displayTxt = "";
      
      if (elapsed < 1000) displayTxt = "3";
      else if (elapsed < 2000) displayTxt = "2";
      else if (elapsed < 3000) displayTxt = "1";
      else if (elapsed < 4000) displayTxt = "GO!";
      else {
        gameState = 'playing';
        playStartTime = millis(); // 紀錄正式開始的時間
      }

      if (displayTxt !== "") {
        fill(255, 255, 0); // 黃色文字
        stroke(0);        // 黑色外框
        strokeWeight(4);
        textAlign(CENTER, CENTER);
        textSize(120);
        text(displayTxt, width / 2, height / 2);
      }
    }

    // --- 繪製計分板 (左上角) ---
    if (gameState === 'playing' || (gameState === 'countdown' && !isGameOver)) {
      fill(255);
      stroke(0);
      strokeWeight(2);
      textAlign(LEFT, TOP);
      textSize(22);
      text(`躲避得分: ${score}`, 30, 30);
      text(`生存時間: ${survivalTime.toFixed(1)}s`, 30, 60);
    }

    // --- 難度增加警告特效 ---
    if (difficultyWarningStart > 0 && millis() - difficultyWarningStart < 3000) {
      let elapsed = millis() - difficultyWarningStart;
      // 每 250 毫秒閃爍一次
      if (Math.floor(elapsed / 250) % 2 === 0) {
        push();
        fill(255, 0, 0);
        stroke(255);
        strokeWeight(4);
        textAlign(CENTER, CENTER);
        textSize(60);
        text("DENSITY INCREASE!", width / 2, height * 0.2);
        
        // 畫面四周紅框閃爍
        noFill();
        stroke(255, 0, 0, 150);
        strokeWeight(20);
        rectMode(CORNER);
        rect(0, 0, width, height);
        pop();
      }
    }

    // --- 遊戲結束介面 ---
    if (isGameOver) {
      push();
      // 半透明黑色遮罩
      fill(0, 150);
      rectMode(CORNER);
      rect(0, 0, width, height);

      // GAME OVER 文字
      fill(255, 0, 0);
      textAlign(CENTER, CENTER);
      textSize(80);
      stroke(255);
      strokeWeight(4);
      text('GAME OVER', width / 2, height / 2 - 120);

      // 顯示最終分數
      fill(255);
      noStroke();
      textSize(32);
      text(`本次得分: ${score}`, width / 2, height / 2 - 40);
      
      if (score >= highScore && score > 0) {
        fill(255, 255, 0);
        text('✨ 恭喜打破紀錄！ 🎉', width / 2, height / 2 - 85);
      }

      // --- 繪製排行榜 ---
      fill(255);
      textSize(22);
      textAlign(CENTER, TOP);
      text("🏆 歷史排行榜 🏆", width / 2, height / 2 + 10);
      
      textSize(18);
      for (let i = 0; i < leaderboard.length; i++) {
        let yPos = height / 2 + 40 + (i * 25);
        // 處理舊版資料結構（只有數字）或新版結構（物件）
        if (typeof leaderboard[i] === 'object') {
          text(`第 ${i + 1} 名: ${leaderboard[i].name} - ${leaderboard[i].score} 分`, width / 2, yPos);
        } else {
          text(`第 ${i + 1} 名: ${leaderboard[i]} 分`, width / 2, yPos);
        }
      }

      // 重新開始按鈕
      let rbW = 200, rbH = 50;
      let buttonY = height / 2 + 180; // 往下移一點，避開排行榜
      let isHover = mouseX > width / 2 - rbW / 2 && mouseX < width / 2 + rbW / 2 &&
                    mouseY > buttonY - rbH / 2 && mouseY < buttonY + rbH / 2;
      
      if (isHover) {
        fill('#e7c6ff');
        rbW *= 1.1;
        rbH *= 1.1;
      } else {
        fill(255);
      }
      
      noStroke();
      rectMode(CENTER);
      rect(width / 2, buttonY, rbW, rbH, 10);
      
      fill(0);
      textSize(20);
      text('重新開始', width / 2, buttonY);
      pop();
    }

    // 轉場邏輯：進入遊戲後減少透明度
    if (isTransitioning) {
      fadeAlpha -= 10;
      if (fadeAlpha <= 0) {
        fadeAlpha = 0;
        isTransitioning = false;
      }
    }
  }

  // 繪製全螢幕轉場遮罩
  if (fadeAlpha > 0) {
    noStroke();
    fill(0, fadeAlpha);
    rectMode(CORNER);
    rect(0, 0, width, height);
  }
}

function mousePressed() {
  // 如果在開始畫面且點擊了畫面中央的按鈕區域
  if (gameState === 'start' && !isTransitioning) {
    let baseW = 250;
    let baseH = 60;
    
    // 檢查「開始遊戲」按鈕 (startY = height/2 - 60)
    if (mouseX > width / 2 - baseW / 2 && mouseX < width / 2 + baseW / 2 &&
        mouseY > height / 2 - 60 - baseH / 2 && mouseY < height / 2 - 60 + baseH / 2) {
      isTransitioning = true;
    }
    
    // 檢查「查看排行榜」按鈕 (lbY = height/2 + 20)
    if (mouseX > width / 2 - baseW / 2 && mouseX < width / 2 + baseW / 2 &&
        mouseY > height / 2 + 20 - baseH / 2 && mouseY < height / 2 + 20 + baseH / 2) {
      gameState = 'leaderboard';
    }
  } else if (gameState === 'leaderboard') {
    // 排行榜返回按鈕 (backY = height/2 + 180)
    let backW = 150, backH = 50;
    if (mouseX > width / 2 - backW / 2 && mouseX < width / 2 + backW / 2 &&
        mouseY > height / 2 + 180 - backH / 2 && mouseY < height / 2 + 180 + backH / 2) {
      gameState = 'start';
    }
  } else if (isGameOver) {
    // 如果在遊戲結束畫面點擊「重新開始」按鈕
    let rbW = 200, rbH = 50;
    let buttonY = height / 2 + 180; // 修改這裡，與 draw() 中的座標一致
    if (
      mouseX > width / 2 - rbW / 2 && mouseX < width / 2 + rbW / 2 &&
      mouseY > buttonY - rbH / 2 && mouseY < buttonY + rbH / 2
    ) {
      baselineY = -1; // 重設基準點
      initObstacles(); // 重置障礙物
      gameState = 'start'; // 回到主畫面，讓玩家可以修改暱稱
      isTransitioning = false; // 重置轉場狀態
      fadeAlpha = 0; // 清除遮罩透明度
    }
  }
}

function updateInputPosition() {
  if (nameInput) {
    // 將輸入框放在開始按鈕下方
    nameInput.position(width / 2 - 85, height / 2 + 115);
  }
}

function windowResized() {
  // 當視窗大小改變時，自動調整畫布大小
  resizeCanvas(windowWidth, windowHeight);
  updateInputPosition();
}

function drawScrollingBackground() {
  imageMode(CORNER);
  // 如果遊戲沒結束，就讓背景座標緩慢往左移
  if (!isGameOver) {
    bgScrollX -= 1; // 這裡控制捲動速度，數字越小越慢
  }
  // 當第一張圖完全移出左側螢幕，重置座標回 0 形成循環
  if (bgScrollX <= -width) {
    bgScrollX = 0;
  }
  // 同時畫出兩張背景圖，一張在當前位置，一張緊接在後
  image(bgImg, bgScrollX, 0, width, height);
  image(bgImg, bgScrollX + width, 0, width, height);
}