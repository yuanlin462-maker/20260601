let capture;
let poseNet;
let noseX = -1;
let noseY = -1;

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  // 擷取攝影機影像
  capture = createCapture(VIDEO);
  capture.size(640, 480); // 設定擷取解析度以維持辨識穩定性
  // 隱藏預設的 HTML5 影片元件，只在畫布上繪製
  capture.hide();

  // 初始化 PoseNet 模型
  poseNet = ml5.poseNet(capture, () => console.log('模型載入成功'));
  // 監聽辨識結果
  poseNet.on('pose', (poses) => {
    if (poses.length > 0) {
      noseX = poses[0].pose.nose.x;
      noseY = poses[0].pose.nose.y;
    }
  });
}

function draw() {
  // 設定背景顏色
  background('#e7c6ff');

  push();
  // 將原點移動到畫布中心
  translate(width / 2, height / 2);
  // 左右顛倒影像 (鏡像效果)
  scale(-1, 1);
  // 設定圖片繪製模式為中心
  imageMode(CENTER);
  // 繪製影像，大小為全螢幕寬高的 50%
  image(capture, 0, 0, width * 0.5, height * 0.5);

  if (noseX !== -1 && noseY !== -1) {
    // 將辨識到的鼻尖座標對應到畫布上的縮放大小
    // 因為影像模式是 CENTER，座標需要從中心點偏移
    let x = map(noseX, 0, capture.width, -width * 0.25, width * 0.25);
    let y = map(noseY, 0, capture.height, -height * 0.25, height * 0.25);

    fill(255, 255, 0); // 黃色
    noStroke();
    ellipse(x, y, 20, 20); // 繪製黃色圓點
  }
  pop();
}

function windowResized() {
  // 當視窗大小改變時，自動調整畫布大小
  resizeCanvas(windowWidth, windowHeight);
}