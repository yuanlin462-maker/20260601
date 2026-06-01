let capture;
let poseNet;
let noseX = -1;
let noseY = -1;
let noseImg;
let gameState = 'start'; // 遊戲狀態：'start' 或 'playing'
let fadeAlpha = 0; // 控制轉場遮罩的透明度
let isTransitioning = false; // 是否處於轉場狀態

function preload() {
  // 載入鼻尖要顯示的圖片
  noseImg = loadImage('圖片/中.jpg');
}

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  // 擷取攝影機影像
  capture = createCapture(VIDEO);
  capture.size(640, 480); // 設定固定解析度以維持辨識準確度
  // 隱藏預設的 HTML5 影片元件，只在畫布上繪製
  capture.hide();

  // 初始化 PoseNet 模型
  poseNet = ml5.poseNet(capture, () => console.log('PoseNet 模型已載入'));
  // 監聽辨識結果，更新鼻尖位置
  poseNet.on('pose', (results) => {
    if (results.length > 0) {
      noseX = results[0].pose.nose.x;
      noseY = results[0].pose.nose.y;
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

    // 如果偵測到鼻尖，則在對應位置顯示圖片
    if (noseX !== -1) {
      // 將 PoseNet 原始座標映射到畫布中央顯示影像的比例範圍內
      // 因為 X 軸已被 scale(-1, 1) 翻轉，圓點會自動跟隨鏡像位置
      let x = map(noseX, 0, capture.width, -imgW / 2, imgW / 2);
      let y = map(noseY, 0, capture.height, -imgH / 2, imgH / 2);

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