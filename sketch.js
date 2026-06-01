let capture;
let poseNet;
let noseX = -1;
let noseY = -1;
let midImg, upImg, downImg;
let noseImg; // 目前顯示的圖片
let gameState = 'start'; // 遊戲狀態：'start' 或 'playing'
let baselineY = -1; // 玩家一開始的 Y 座標基準
let fadeAlpha = 0; // 控制轉場遮罩的透明度
let isTransitioning = false; // 是否處於轉場狀態
let obstacles = []; // 儲存障礙物長方形
let isGameOver = false; // 遊戲是否結束（停止滾動）
let countdownStartTime = 0; // 紀錄倒數開始的時間
let score = 0; // 躲過的障礙物數量
let survivalTime = 0; // 生存秒數
let playStartTime = 0; // 進入 playing 狀態的時間點
let highScore = 0; // 歷史最高分

function preload() {
  // 載入不同狀態的圖片
  midImg = loadImage('圖片/中.png');
  upImg = loadImage('圖片/上.png');
  downImg = loadImage('圖片/下.png');
  noseImg = midImg; // 初始預設為中
}

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);

  initObstacles();
  // 從瀏覽器讀取最高分紀錄
  highScore = parseInt(localStorage.getItem('p5_highScore')) || 0;

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

        if (diff < -threshold) noseImg = upImg;      // 座標變小代表向上
        else if (diff > threshold) noseImg = downImg; // 座標變大代表向下
        else noseImg = midImg;                       // 在基準點附近則顯示中間
      }

      noseX = newNoseX;
      noseY = newNoseY;
    }
  });
}

function initObstacles() {
  obstacles = [];
  let spacing = 350; // 長條形之間的水平間距
  for (let i = 0; i < 5; i++) {
    obstacles.push({
      // 在 scale(-1, 1) 下，負值代表視覺右側。從右側外開始排列。
      x: -width * 0.6 - i * spacing,
      h: random(100, height * 0.42), // 根據 70% 影像高度隨機
      w: 80,
      speed: 3,
      isTop: i % 2 === 0
    });
  }
  score = 0;
  survivalTime = 0;
  isGameOver = false;
}

function draw() {
  if (gameState === 'start') {
    // --- 開始畫面 ---
    background(0); // 黑色背景

    let baseW = 250;
    let baseH = 60;
    let btnW = baseW;
    let btnH = baseH;

    // 檢查滑鼠是否在按鈕區域內 (Hover 偵測)
    let isHover = mouseX > width / 2 - baseW / 2 && mouseX < width / 2 + baseW / 2 &&
                  mouseY > height / 2 - baseH / 2 && mouseY < height / 2 + baseH / 2;

    // 繪製按鈕外框
    rectMode(CENTER);
    if (isHover) {
      fill('#e7c6ff'); // 懸停時變色
      btnW = baseW * 1.1; // 放大 10%
      btnH = baseH * 1.1;
    } else {
      fill(255); // 預設白色
    }
    noStroke();
    rect(width / 2, height / 2, btnW, btnH, 10);

    // 轉場邏輯：點擊後增加透明度
    if (isTransitioning) {
      fadeAlpha += 10;
      if (fadeAlpha >= 255) {
        fadeAlpha = 255;
        gameState = 'countdown';
        countdownStartTime = millis(); // 開始倒數計時
      }
    }

    // 按鈕文字閃爍邏輯
    if (frameCount % 60 < 30) {
      fill(0);
      textAlign(CENTER, CENTER);
      textSize(isHover ? 26 : 24); // 文字也隨之放大
      text('按下開始遊戲', width / 2, height / 2);
    }
  } else if (gameState === 'countdown' || gameState === 'playing') {
    // --- 影像顯示畫面 ---
    // 設定背景顏色
    background('#e7c6ff');

    push();
    // 將原點移動到畫布中心
    translate(width / 2, height / 2);
    // 左右顛倒影像 (鏡像效果)
    scale(-1, 1);
    // 設定圖片繪製模式為中心
    imageMode(CENTER);
    
    let imgW = width * 0.7;
    let imgH = height * 0.7;

    // 繪製影像，大小為全螢幕寬高的 70%
    image(capture, 0, 0, imgW, imgH);

    // --- 繪製並更新長方形障礙物 ---
    fill(0); // 黑色長方形
    noStroke();
    rectMode(CORNER);

    for (let obs of obstacles) {
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
          // 找出目前所有障礙物中最右邊（x 最小）的一個
          let farX = imgW / 2;
          for (let other of obstacles) {
            if (other.x < farX) farX = other.x;
          }
          // 將回收的長方形放到最後面（最右側），並加上間距
          obs.x = farX - (350 + score * 5); // 隨速度增加稍微拉大間距防止視覺過於擁擠
          obs.h = random(100, imgH * 0.6); // 重新設定隨機長度
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
            // 檢查並更新最高分
            if (score > highScore) {
              highScore = score;
              localStorage.setItem('p5_highScore', highScore);
            }
          }
        }
      }

      // 繪製圖片 (100x100 為示意大小，可自行調整)
      image(noseImg, x, y, 100, 100);
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
      text(`得分: ${score}  |  時間: ${survivalTime.toFixed(1)} 秒`, width / 2, height / 2 - 30);
      
      textSize(24);
      text(`最高紀錄: ${highScore}`, width / 2, height / 2 + 10);

      if (score >= highScore && score > 0) {
        fill(255, 255, 0);
        text('✨ 恭喜打破紀錄！ 🎉', width / 2, height / 2 - 75);
      }

      // 重新開始按鈕
      let rbW = 200, rbH = 50;
      let buttonY = height / 2 + 80;
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
    let btnW = 250;
    let btnH = 60;
    if (
      mouseX > width / 2 - btnW / 2 && mouseX < width / 2 + btnW / 2 &&
      mouseY > height / 2 - btnH / 2 && mouseY < height / 2 + btnH / 2
    ) {
      isTransitioning = true;
    }
  } else if (isGameOver) {
    // 如果在遊戲結束畫面點擊「重新開始」按鈕
    let rbW = 200, rbH = 50;
    let buttonY = height / 2 + 80;
    if (
      mouseX > width / 2 - rbW / 2 && mouseX < width / 2 + rbW / 2 &&
      mouseY > buttonY - rbH / 2 && mouseY < buttonY + rbH / 2
    ) {
      baselineY = -1; // 重設基準點
      initObstacles(); // 重置障礙物
      gameState = 'countdown'; // 回到倒數狀態
      countdownStartTime = millis();
    }
  }
}

function windowResized() {
  // 當視窗大小改變時，自動調整畫布大小
  resizeCanvas(windowWidth, windowHeight);
}