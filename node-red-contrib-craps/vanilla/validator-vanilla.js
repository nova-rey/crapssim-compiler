module.exports = function(RED) {
    const {
        getVarTable,
        dollarsFromUnitsOrLiteral,
        legalizeBetByType
    } = require("./legalizer.js");

    function ValidatorVanilla(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const strict = !!config.strict;           // if true, any issue flips ok=false
        const dedupe = config.dedupe !== false;   // default true: combine duplicates

        node.on("input", function(msg, send, done) {
            try {
                const flow = node.context().flow;
                const vt = getVarTable(flow, msg); // includes bubble/non-bubble & increments
                const warnings = [];
                const errors = [];

                // 1) Get incoming bets list
                let betsIn = Array.isArray(msg.bets) ? msg.bets
                : (msg.strategyGraph && Array.isArray(msg.strategyGraph.bets)) ? msg.strategyGraph.bets
                : [];
                if (!Array.isArray(betsIn)) betsIn = [];

                // 2) Normalize & sanity check each bet
                const out = [];
                for (const raw of betsIn) {
                    const b = raw || {};

                    // type
                    const t = (b.type || "").toString().trim();
                    if (!t) { warnings.push("Skipped bet with missing type."); continue; }
                    const type = t.toLowerCase();

                    // name (for props)
                    const name = (b.name || "").toString().trim();

                    // point (for certain bet types)
                    const point = b.point != null ? Number(b.point) : undefined;
                    const needsPoint = ["place","lay","hardway","odds"].includes(type);
                    const validPoint = [4,5,6,8,9,10].includes(Number(point));
                    if (needsPoint && !validPoint) {
                        warnings.push(`Skipped ${type} bet with invalid or missing point (${String(point)}).`);
                        continue;
                    }

                    // 2a) Resolve value → dollars (bubble-aware)
                    // Accept {units|dollars} or numeric. negative/NaN become 0 and get skipped w/ warning.
                    const value = (b.value !== undefined ? b.value : b.amount);
                    let pre = dollarsFromUnitsOrLiteral(value, vt);
                    if (!Number.isFinite(pre) || pre <= 0) {
                        warnings.push(`${type}${needsPoint ? ` ${point}` : ""}: non-positive amount; skipped.`);
                        continue;
                    }

                    // 2b) Light “legalization” pass:
                    //   - In bubble mode: leave $1 increments (no rounding), just floor to int >= 1.
                    //   - In non-bubble: use legalizer rules to round to table-legal increments/mins.
                    let dollars = pre;
                    const before = pre;
                    try {
                        dollars = legalizeBetByType({ type, point, name }, pre, undefined, vt);
                    } catch (e) {
                        // If legalizer throws (unknown type etc.), just keep original and warn.
                        dollars = pre;
                        warnings.push(`${type}${needsPoint ? ` ${point}` : ""}: could not validate amount (${String(e.message || e)}). Using original ${before}.`);
                    }

                    // In bubble mode, legalizer should effectively no-op; still detect changes.
                    if (dollars !== before) {
                        warnings.push(`${type}${needsPoint ? ` ${point}` : ""}: adjusted ${before} → ${dollars}${vt?.bubble ? " (bubble allowed; non-bubble rounding illustrated)" : ""}.`);
                    }

                    // Assemble normalized bet record
                    const norm = { type, dollars };
                    if (needsPoint) norm.point = Number(point);
                    if (name) norm.name = name;
                    out.push(norm);
                }

                // 3) Dedupe/aggregate duplicates (optional)
                // Combine same-type+point bets to a single dollars sum. Keep props separate by name.
                let finalBets = out;
                if (dedupe) {
                    const map = new Map();
                    for (const b of out) {
                        const key =
                        (b.type === "place" || b.type === "lay" || b.type === "hardway" || b.type === "odds")
                        ? `${b.type}:${b.point}:${b.name || ""}`
                        : (b.type === "prop" || b.type === "proposition")
                        ? `${b.type}:${(b.name || "").toLowerCase()}`
                        : `${b.type}`;
                        const prev = map.get(key);
                        if (prev) {
                            prev.dollars += b.dollars;
                        } else {
                            map.set(key, { ...b });
                        }
                    }
                    finalBets = [...map.values()];
                    if (finalBets.length < out.length) {
                        warnings.push("Combined duplicate bets of the same type/point.");
                    }
                }

                // 4) Simple structural sanity checks (non-fatal)
                // - Unknown type set (after we processed): warn once if any are outside the known set
                const known = new Set(["pass","dont_pass","come","dont_come","field","place","lay","hardway","prop","proposition","odds"]);
                const unknownSeen = finalBets.some(b => !known.has(b.type));
                if (unknownSeen) {
                    warnings.push("Some bets have unrecognized types; exporter may fall back or ignore them.");
                }

                // 5) Prepare output and result
                msg.bets = finalBets;
                msg.validation = {
                    ok: !(strict ? (warnings.length || errors.length) : errors.length),
                warnings,
                errors,
                table: {
                    ...(vt || {})
                }
                };

                node.status({
                    fill: msg.validation.ok ? (warnings.length ? "yellow" : "green") : "red",
                            shape: msg.validation.ok ? (warnings.length ? "ring" : "dot") : "dot",
                            text: msg.validation.ok
                            ? (warnings.length ? `${warnings.length} warning(s)` : "ok")
                            : `errors: ${errors.length}`
                });

                send(msg);
                done && done();
            } catch (e) {
                node.error(e);
                done && done(e);
            }
        });
    }

    RED.nodes.registerType("validator", ValidatorVanilla);
};
