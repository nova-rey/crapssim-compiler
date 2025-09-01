module.exports = function(RED) {
    function normalizeType(t) {
        const s = String(t || "").toLowerCase().replace(/\s+/g, "_");
        if (s === "pass" || s === "betpassline" || s === "bet_pass" || s === "passline") return "pass";
        if (s === "dontpass" || s === "dont_pass" || s === "don't_pass" || s === "betdontpass") return "dont_pass";
        if (s === "come" || s === "betcome") return "come";
        if (s === "dontcome" || s === "dont_come" || s === "don't_come" || s === "betdontcome") return "dont_come";
        if (s === "field" || s === "betfield") return "field";
        if (s === "place" || s === "betplace") return "place";
        if (s === "lay" || s === "betlay") return "lay";
        if (s === "hardway" || s === "hard" || s === "bethardway") return "hardway";
        if (s === "prop" || s === "proposition") return "prop";
        if (s === "odds") return "odds";
        return s || "";
    }

    function asInt(n) {
        const v = Number(n);
        return Number.isFinite(v) ? Math.round(v) : undefined;
    }

    function makePredicate(cfg, runtimeClear) {
        // runtimeClear can override config: { all: true } or { types:[], points:[] }
        const mode = (runtimeClear && runtimeClear.all) ? "all" : (cfg.mode || "all");

        if (mode === "all") {
            return () => true; // remove everything
        }

        // Merge selection from config + runtime
        const selTypesCfg = Array.isArray(cfg.types) ? cfg.types : (typeof cfg.types === "string" ? cfg.types.split(",") : []);
        const selPointsCfg = Array.isArray(cfg.points) ? cfg.points : (typeof cfg.points === "string" ? cfg.points.split(",") : []);
        const selTypesRun = Array.isArray(runtimeClear?.types) ? runtimeClear.types : [];
        const selPointsRun = Array.isArray(runtimeClear?.points) ? runtimeClear.points : [];

        const typeSet = new Set([...selTypesCfg, ...selTypesRun].map(normalizeType).filter(Boolean));
        const pointSet = new Set([...selPointsCfg, ...selPointsRun].map(asInt).filter(v => [4,5,6,8,9,10].includes(v)));

        const hasTypeFilter = typeSet.size > 0;
        const hasPointFilter = pointSet.size > 0;

        // If user picked "specific" but gave no filters, do nothing
        if (!hasTypeFilter && !hasPointFilter) {
            return () => false;
        }

        return (bet) => {
            const bType = normalizeType(bet?.type);
            const bPoint = asInt(bet?.point);

            const typeMatch  = hasTypeFilter  ? typeSet.has(bType) : false;
            const pointMatch = hasPointFilter ? pointSet.has(bPoint) : false;

            // Matching rules:
            // - If both filters provided: remove when BOTH match (e.g., only Place on 6 & 8)
            // - If only types provided:   remove when type matches
            // - If only points provided:  remove any bet tied to that point (place/lay/hardway/odds on that point)
            if (hasTypeFilter && hasPointFilter) return typeMatch && pointMatch;
            if (hasTypeFilter) return typeMatch;
            return pointMatch;
        };
    }

    function ClearNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.on("input", function(msg, send, done) {
            try {
                const bets = Array.isArray(msg.bets) ? msg.bets : [];
                const runtimeClear = msg.clear && typeof msg.clear === "object" ? msg.clear : (msg.clear === "all" ? { all:true } : null);
                const shouldRemove = makePredicate(config, runtimeClear);

                if (!bets.length) { send(msg); return done && done(); }

                // Filter bets
                const kept = bets.filter(b => !shouldRemove(b));

                msg.bets = kept;
                // Convenience: track what we cleared
                msg.cleared = bets.length - kept.length;

                // If we cleared everything and you want to also wipe any grouped dicts upstream, do that in exporter; here we only prune msg.bets
                send(msg);
                done && done();
            } catch (err) {
                node.error(err, msg);
                done && done(err);
            }
        });
    }

    RED.nodes.registerType("clear", ClearNode);
};
