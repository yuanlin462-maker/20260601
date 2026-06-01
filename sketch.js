let capture;

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  // 擷取攝影機影像
  capture = createCapture(VIDEO);
  // 隱藏預設的 HTML5 影片元件，只在畫布上繪製
  capture.hide();
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
  pop();
}

function windowResized() {
  // 當視窗大小改變時，自動調整畫布大小
  resizeCanvas(windowWidth, windowHeight);
}