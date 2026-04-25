// Manejo de estado de sesión
const sessionStates = new Map();

function getSessionState(sessionId = 'default') {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      // Estado antiguo (mantenido para compatibilidad)
      activeDocument: null,
      lastImageText: null,
      lastPdfContent: null,
      lastPdfMetadata: null,
      // Estado universal - NUEVO
      lastDocumentContent: null,
      lastDocumentMetadata: null,
      lastDocumentFilename: null
    });
  }
  return sessionStates.get(sessionId);
}

export { getSessionState };
