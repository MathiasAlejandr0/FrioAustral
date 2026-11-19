/** «Preguntas de otros»: pares pregunta → primera respuesta del equipo, sin datos de quién preguntó.
 * Recorre una vez los mensajes ya ordenados (antes, cada pregunta copiaba y recorría toda la cola).
 */
const MAX_ITEMS = 60;

/** rows: mensajes {user_id, sender, body, created_at} en cualquier orden. q: búsqueda en minúsculas. */
function communityItems(rows, q = "") {
  const sorted = (rows || []).slice().sort((a, b) =>
    String(a.user_id).localeCompare(String(b.user_id)) || String(a.created_at).localeCompare(String(b.created_at)));
  const nextReplies = new Map(), nextQuestions = new Map();
  const items = [];
  /* De atrás hacia delante, conservando la misma regla de emparejamiento que antes (también en empates de hora). */
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    if (m.sender === "equipo") { nextReplies.set(m.user_id, m); continue; }
    if (m.sender !== "cliente") continue;
    const reply = nextReplies.get(m.user_id), nextQ = nextQuestions.get(m.user_id);
    nextQuestions.set(m.user_id, m);
    if (!reply || (nextQ && new Date(nextQ.created_at) < new Date(reply.created_at))) continue;
    const pregunta = String(m.body || ""), respuesta = String(reply.body || "");
    if (q && !(pregunta.toLowerCase().includes(q) || respuesta.toLowerCase().includes(q))) continue;
    items.push({ pregunta, respuesta, fecha: reply.created_at });
  }
  items.reverse(); /* orden estable original para respuestas con la misma hora */
  items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return items.slice(0, MAX_ITEMS);
}

module.exports = { communityItems, MAX_ITEMS };
