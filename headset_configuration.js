let polyfill = null;
let xrSession = null;
let xrInputSources = null;
let xrReferenceSpace = null;
let xrButton = null;
let gl = null;
let animationFrameRequestID = 0;
let shaderProgram = null;
let programInfo = null;
let buffers = null;
let texture = null;
let mouseYaw = 0;
let mousePitch = 0;

const viewerStartPosition = vec3.fromValues(0, 0, -10);
const viewerStartOrientation = vec3.fromValues(0, 0, 1.0);

const cubeOrientation = vec3.create();
const cubeMatrix = mat4.create();
const mouseMatrix = mat4.create();
const inverseOrientation = quat.create();
const RADIANS_PER_DEGREE = Math.PI / 180.0;

function LogGLError(where) {
    let err = gl.getError();
    if (err) {
      console.error(`WebGL error returned by ${where}: ${err}`);
    }
  }

window.addEventListener("load", onLoad);

function onLoad() {
  xrButton = document.querySelector("#enter-xr");
  xrButton.addEventListener("click", onXRButtonClick);

  projectionMatrixOut = document.querySelector("#projection-matrix div");
  modelMatrixOut = document.querySelector("#model-view-matrix div");
  cameraMatrixOut = document.querySelector("#camera-matrix div");
  mouseMatrixOut = document.querySelector("#mouse-matrix div");
  
  if (!navigator.xr || enableForcePolyfill) {
    console.log("Using the polyfill");
    polyfill = new WebXRPolyfill();
  }
  setupXRButton();
}

function setupXRButton() {
  if (navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported(SESSION_TYPE)
    .then((supported) => {
      xrButton.disabled = !supported;
    });
  } else {
    navigator.xr.supportsSession(SESSION_TYPE)
    .then(() => {
      xrButton.disabled = false;
    })
    .catch(() => {
      xrButton.disabled = true;
    });
  }
}

async function onXRButtonClick(event) {
  if (!xrSession) {
    navigator.xr.requestSession(SESSION_TYPE)
    .then(sessionStarted);
  } else {
    await xrSession.end();

    if (xrSession) {
      sessionEnded();
    }
  }
}

function sessionStarted(session) {
    let refSpaceType;
  
    xrSession = session;  
    xrButton.innerText = "Exit WebXR";
    xrSession.addEventListener("end", sessionEnded);
    
    let canvas = document.querySelector("canvas");
    gl = canvas.getContext("webgl", { xrCompatible: true });
  
    if (allowMouseRotation) {
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("contextmenu", (event) => { event.preventDefault(); });
    }
      
    if (allowKeyboardMotion) {
      document.addEventListener("keydown", handleKeyDown);
    }
  
    shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  
    programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
        textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
        uSampler: gl.getUniformLocation(shaderProgram, 'uSampler')
      },
    };
  
    buffers = initBuffers(gl);
    texture = loadTexture(gl, 'https://cdn.glitch.com/a9381af1-18a9-495e-ad01-afddfd15d000%2Ffirefox-logo-solid.png?v=1575659351244');
    
    xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(xrSession, gl)
    });
        
    if (SESSION_TYPE == "immersive-vr") {
      refSpaceType = "local";
    } else {
      refSpaceType = "viewer";
    }
  
    mat4.fromTranslation(cubeMatrix, viewerStartPosition); 
      
    vec3.copy(cubeOrientation, viewerStartOrientation);
  
    xrSession.requestReferenceSpace(refSpaceType)
    .then((refSpace) => {
      xrReferenceSpace = refSpace.getOffsetReferenceSpace(
            new XRRigidTransform(viewerStartPosition, cubeOrientation));
      animationFrameRequestID = xrSession.requestAnimationFrame(drawFrame);
    });
    
    return xrSession;
  }

  function sessionEnded() {
    xrButton.innerText = "Enter WebXR";
    
    if (animationFrameRequestID) {
      xrSession.cancelAnimationFrame(animationFrameRequestID);
      animationFrameRequestID = 0;
    }
    xrSession = null;
  }

  function handleKeyDown(event) {
    switch(event.key) {
      case "w":
      case "W":
        verticalDistance -= MOVE_DISTANCE;
        break;
      case "s":
      case "S":
        verticalDistance += MOVE_DISTANCE;
        break;
      case "a":
      case "A":
        transverseDistance += MOVE_DISTANCE;
        break;
      case "d":
      case "D":
        transverseDistance -= MOVE_DISTANCE;
        break;
      case "ArrowUp":
        axialDistance += MOVE_DISTANCE;
        break;
      case "ArrowDown":
        axialDistance -= MOVE_DISTANCE;
        break;
      case "r":
      case "R":
        transverseDistance = axialDistance = verticalDistance = 0;
        mouseYaw = mousePitch = 0;
        break;
      default:
        break;
    }
  }

  function handlePointerMove(event) {
    if (event.buttons & 2) {
      rotateViewBy(event.movementX, event.movementY);
    }
  }

  function rotateViewBy(dx, dy) {
    mouseYaw -= dx * MOUSE_SPEED;
    mousePitch -= dy * MOUSE_SPEED;
  
    if (mousePitch < -Math.PI * 0.5) {
      mousePitch = -Math.PI * 0.5;
    } else if (mousePitch > Math.PI * 0.5) {
      mousePitch = Math.PI * 0.5;
    }
  }

  let lastFrameTime = 0;

  function drawFrame(time, frame) {
    let session = frame.session;
    let adjustedRefSpace = xrReferenceSpace;
    let pose = null;
   
    animationFrameRequestID = session.requestAnimationFrame(drawFrame); 
    adjustedRefSpace = applyViewerControls(xrReferenceSpace);
    pose = frame.getViewerPose(adjustedRefSpace);
   
    if (pose) {
      let glLayer = session.renderState.baseLayer;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
      LogGLError("bindFrameBuffer");
  
      gl.clearColor(0, 0, 0, 1.0);
      gl.clearDepth(1.0);                 // Clear everything
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      LogGLError("glClear");
          
      const deltaTime = (time - lastFrameTime) * 0.001;  // Convert to seconds
      lastFrameTime = time;
  
      for (let view of pose.views) {
        let viewport = glLayer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        LogGLError(`Setting viewport for eye: ${view.eye}`);
        gl.canvas.width = viewport.width * pose.views.length;
        gl.canvas.height = viewport.height;
        drawScene(gl, view, programInfo, buffers, texture, deltaTime);
      }
    }
  }

  function applyViewerControls(refSpace) {
    if (!mouseYaw && !mousePitch && !axialDistance &&
        !transverseDistance && !verticalDistance) {
      return refSpace;
    }
    
    quat.identity(inverseOrientation);
    quat.rotateX(inverseOrientation, inverseOrientation, -mousePitch);
    quat.rotateY(inverseOrientation, inverseOrientation, -mouseYaw);
   
    let newTransform = new XRRigidTransform({x: transverseDistance,
                                             y: verticalDistance,
                                             z: axialDistance},
                           {x: inverseOrientation[0], y: inverseOrientation[1],
                            z: inverseOrientation[2], w: inverseOrientation[3]});
    mat4.copy(mouseMatrix, newTransform.matrix);
   
    return refSpace.getOffsetReferenceSpace(newTransform);
  }

  const normalMatrix = mat4.create();
  const modelViewMatrix = mat4.create();
  
  function renderScene(gl, view, programInfo, buffers, texture, deltaTime) {
    const xRotationForTime = (xRotationDegreesPerSecond * RADIANS_PER_DEGREE) * deltaTime;
    const yRotationForTime = (yRotationDegreesPerSecond * RADIANS_PER_DEGREE) * deltaTime;
    const zRotationForTime = (zRotationDegreesPerSecond * RADIANS_PER_DEGREE) * deltaTime;
   
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
   
    if (enableRotation) {
      mat4.rotate(cubeMatrix,  // destination matrix
                  cubeMatrix,  // matrix to rotate
                  zRotationForTime,     // amount to rotate in radians
                  [0, 0, 1]);       // axis to rotate around (Z)
      mat4.rotate(cubeMatrix,  // destination matrix
                  cubeMatrix,  // matrix to rotate
                  yRotationForTime, // amount to rotate in radians
                  [0, 1, 0]);       // axis to rotate around (Y)
      mat4.rotate(cubeMatrix,  // destination matrix
                  cubeMatrix,  // matrix to rotate
                  xRotationForTime, // amount to rotate in radians
                  [1, 0, 0]);       // axis to rotate around (X)
    }
  
    mat4.multiply(modelViewMatrix, view.transform.inverse.matrix, cubeMatrix);    
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
  
    displayMatrix(view.projectionMatrix, 4, projectionMatrixOut);    
    displayMatrix(modelViewMatrix, 4, modelMatrixOut);
    displayMatrix(view.transform.matrix, 4, cameraMatrixOut);
    displayMatrix(mouseMatrix, 4, mouseMatrixOut);
  
    {
      const numComponents = 3;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.vertexAttribPointer(
          programInfo.attribLocations.vertexPosition,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      gl.enableVertexAttribArray(
          programInfo.attribLocations.vertexPosition);
    }
  
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
      gl.vertexAttribPointer(
          programInfo.attribLocations.textureCoord,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      gl.enableVertexAttribArray(
          programInfo.attribLocations.textureCoord);
    }
  
    {
      const numComponents = 3;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
      gl.vertexAttribPointer(
          programInfo.attribLocations.vertexNormal,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      gl.enableVertexAttribArray(
          programInfo.attribLocations.vertexNormal);
    }
  
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.useProgram(programInfo.program);
  
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        view.projectionMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.normalMatrix,
        false,
        normalMatrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);
  
    {
      const vertexCount = 36;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }
  }

  function displayMatrix(mat, rowLength, target) {
    let outHTML = "";
  
    if (mat && rowLength && rowLength <= mat.length) {
      let numRows = mat.length / rowLength;
      outHTML = "<math xmlns='http://www.w3.org/1998/Math/MathML' display='block'>\n<mrow>\n<mo>[</mo>\n<mtable>\n";
      
      for (let y=0; y<numRows; y++) {
        outHTML += "<mtr>\n";
        for (let x=0; x<rowLength; x++) {
          outHTML += `<mtd><mn>${mat[(x*rowLength) + y].toFixed(2)}</mn></mtd>\n`;
        }
        outHTML += "</mtr>\n";
      }
      
      outHTML += "</mtable>\n<mo>]</mo>\n</mrow>\n</math>";
    }
   
    target.innerHTML = outHTML;
  }