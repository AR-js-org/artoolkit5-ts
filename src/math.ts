// math.ts
import { ARToolKitState } from './domain';

export function getCameraProjectionMatrix(state: ARToolKitState): Float64Array {
    return  state.core.getCameraLens();
}

export function transMatToGLMat(transMat: Float64Array, glMat?: Float32Array): Float32Array {
    if (glMat === undefined) {
        glMat = new Float32Array(16);
    }
    glMat[0] = transMat[0];
    glMat[1] = transMat[4];
    glMat[2] = transMat[8];
    glMat[3] = 0.0;

    glMat[4] = transMat[1];
    glMat[5] = transMat[5];
    glMat[6] = transMat[9];
    glMat[7] = 0.0;

    glMat[8] = transMat[2];
    glMat[9] = transMat[6];
    glMat[10] = transMat[10];
    glMat[11] = 0.0;

    glMat[12] = transMat[3];
    glMat[13] = transMat[7];
    glMat[14] = transMat[11];
    glMat[15] = 1.0;

    return glMat;
}

export function arglCameraViewRHf(glMatrix:any, glRhMatrix?:any, scale?: number) {

    let m_modelview;
    if(glRhMatrix == undefined)
        m_modelview = new Float64Array(16);
    else
        m_modelview = glRhMatrix;

    // x
    m_modelview[0] = glMatrix[0];
    m_modelview[4] = glMatrix[4];
    m_modelview[8] = glMatrix[8];
    m_modelview[12] = glMatrix[12];
    // y
    m_modelview[1] = -glMatrix[1];
    m_modelview[5] = -glMatrix[5];
    m_modelview[9] = -glMatrix[9];
    m_modelview[13] = -glMatrix[13];
    // z
    m_modelview[2] = -glMatrix[2];
    m_modelview[6] = -glMatrix[6];
    m_modelview[10] = -glMatrix[10];
    m_modelview[14] = -glMatrix[14];

    // 0 0 0 1
    m_modelview[3] = 0;
    m_modelview[7] = 0;
    m_modelview[11] = 0;
    m_modelview[15] = 1;

    if(scale != undefined && scale !== 0.0) {
        m_modelview[12] *= scale;
        m_modelview[13] *= scale;
        m_modelview[14] *= scale;
    }

    glRhMatrix = m_modelview;

    return glRhMatrix;
}