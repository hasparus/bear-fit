if (__SERVER_URL__) console.log(`🌎 Running against ${__SERVER_URL__}.`);

export const serverUrl = __SERVER_URL__ || window.location.origin;
