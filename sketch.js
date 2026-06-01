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
  
  // 初始化障礙物（產生 5 個隨機長短的長方形）
  for (let i = 0; i < 5; i++) {
    obstacles.push({
      x: random(width * 0.5, width * 1.5), // 初始位置在右側外
      y: random(-height * 0.3, height * 0.3), // 在 70% 區域內隨機高度
      w: random(100, 300),
      h: 30,
      speed: random(2, 5)
    });
  }

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

      // 當進入遊戲狀態後，捕捉初始位置作為基準點
      if (gameState === 'playing') {
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
        gameState = 'playing';
      }
    }

    // 文字閃爍邏輯：利用 frameCount 控制顯示與否
    if (frameCount % 60 < 30) {
      fill(0);
      textAlign(CENTER, CENTER);
      textSize(isHover ? 26 : 24); // 文字也隨之放大
      text('按下開始遊戲', width / 2, height / 2);
    }
  } else {
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
      rect(obs.x, obs.y, obs.w, obs.h);

      // 如果遊戲未結束，則向左移動
      if (!isGameOver) {
        obs.x -= obs.speed;
        // 舊的消失後從右邊重新出現
        if (obs.x + obs.w < -imgW / 2) {
          obs.x = imgW / 2;
          obs.y = random(-imgH / 2, imgH / 2 - obs.h);
          obs.w = random(100, 300);
        }
      }
    }

    // 如果偵測到鼻尖，則在對應位置顯示圖片
    if (noseX !== -1) {
      // 將 PoseNet 原始座標映射到畫布中央顯示影像的比例範圍內
      let x = map(noseX, 0, capture.width, -imgW / 2, imgW / 2);
      let y = map(noseY, 0, capture.height, -imgH / 2, imgH / 2);

      // 碰撞偵測邏輯
      // 鼻尖圖片大小約為 100x100，使用 imageMode(CENTER)，所以範圍是 [x-50, x+50]
      if (!isGameOver) {
        for (let obs of obstacles) {
          if (x + 40 > obs.x && x - 40 < obs.x + obs.w &&
              y + 40 > obs.y && y - 40 < obs.y + obs.h) {
            isGameOver = true; // 碰到長方形，停止滾動
          }
        }
      }

      // 繪製圖片 (100x100 為示意大小，可自行調整)
      image(noseImg, x, y, 100, 100);
    }
    pop();

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
  }
}

function windowResized() {
  // 當視窗大小改變時，自動調整畫布大小
  resizeCanvas(windowWidth, windowHeight);
}