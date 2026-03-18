// ─── Template Configuration ──────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "eid_dark",
    name: "Dark",
    qr: "templates/qr-dark.svg",
    noqr: "templates/no-qr-dark.svg",
  },
  {
    id: "eid_light",
    name: "Light",
    qr: "templates/qr-light.svg",
    noqr: "templates/no-qr-light.svg",
  },
];

// ─── Template Cache ──────────────────────────────────────────────────────────
const _templateCache = {};

async function loadTemplate(path) {
  if (_templateCache[path]) return _templateCache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error("Failed to load template: " + path);
  const text = await res.text();
  _templateCache[path] = text;
  return text;
}

// ─── Main Generator ──────────────────────────────────────────────────────────
async function bkashify(templateId, number, faceImage, qrImage) {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error("Unknown template: " + templateId);

  const svgPath = qrImage ? template.qr : template.noqr;
  let svg = await loadTemplate(svgPath);

  svg = svg.replace("{{BKASH_NUMBER}}", number);
  svg = svg.replace("{{FACE_IMAGE}}", faceImage);
  if (qrImage) {
    svg = svg.replace("{{QR_IMAGE}}", qrImage);
  }

  return svg;
}

// ─── QR Detection & Cropping ─────────────────────────────────────────────────
function detectAndCropQR(imageDataUrl) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(imageData.data, imageData.width, imageData.height);

      if (!code) {
        reject("No QR code detected. Try a clearer image.");
        return;
      }

      var corners = [
        code.location.topLeftCorner,
        code.location.topRightCorner,
        code.location.bottomLeftCorner,
        code.location.bottomRightCorner,
      ];

      var xs = corners.map(function (c) { return c.x; });
      var ys = corners.map(function (c) { return c.y; });
      var minX = Math.min.apply(null, xs);
      var maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys);
      var maxY = Math.max.apply(null, ys);

      var size = Math.max(maxX - minX, maxY - minY);
      var padding = size * 0.08;
      var centerX = (minX + maxX) / 2;
      var centerY = (minY + maxY) / 2;
      var cropSize = size + padding * 2;

      var cropX = Math.max(0, centerX - cropSize / 2);
      var cropY = Math.max(0, centerY - cropSize / 2);
      cropSize = Math.min(
        cropSize,
        canvas.width - cropX,
        canvas.height - cropY
      );

      var cropCanvas = document.createElement("canvas");
      var outSize = Math.min(1024, Math.ceil(cropSize));
      cropCanvas.width = outSize;
      cropCanvas.height = outSize;
      var cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(
        img,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        outSize,
        outSize
      );

      resolve(cropCanvas.toDataURL("image/png"));
    };
    img.onerror = function () {
      reject("Failed to load image for QR detection.");
    };
    img.src = imageDataUrl;
  });
}

// ─── SVG to PNG Helpers ──────────────────────────────────────────────────────
function getSvgUrl(svg) {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

function svgUrlToPng(svgUrl, callback) {
  var svgImage = new Image();
  svgImage.decoding = "async";
  svgImage.onload = function () {
    var canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(svgImage, 0, 0, 1080, 1920);
    var imgData = canvas.toDataURL("image/png");
    callback(imgData);
  };
  svgImage.onerror = function () {
    throw new Error("Failed to render SVG template.");
  };
  svgImage.src = svgUrl;
}

function svgToPng(svg, callback) {
  var url = getSvgUrl(svg);
  svgUrlToPng(url, function (imgData) {
    callback(imgData);
    URL.revokeObjectURL(url);
  });
}
