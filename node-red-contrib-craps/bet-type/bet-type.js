module.exports = function(RED) {
    function BetTypeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        function pullFeed(msg, betId) {
            if (msg && typeof msg === "object") {
                if (msg.var && typeof msg.var === "object" && typeof msg.var.value === "number") {
                    return { amount: msg.var.value, unitType: msg.var.unitType || "units" };
                }
                if (betId && msg.vars && typeof msg.vars === "object" && msg.vars[betId]) {
                    const v = msg.vars[betId];
                    if (typeof v.value === "number") {
                        return { amount: v.value, unitType: v.unitType || "units" };
                    }
                }
                if (typeof msg.amount === "number") {
                    return { amount: msg.amount, unitType: msg.unitType || "units" };
                }
            }
            return null;
        }

        node.on("input", function(msg, send, done) {
            try {
                const kind   = config.kind || "Pass";
                const number = (config.number !== "" && config.number !== null) ? Number(config.number) : undefined;
                const betId  = (config.betId || "").trim();
                const note   = (config.note || "").trim();

                let amount, unitType;
                if (config.valueSource === "fixed") {
                    amount   = Number(config.amount || 0);
                    unitType = config.unitType || "units";
                } else {
                    const fed = pullFeed(msg, betId);
                    if (!fed) { node.warn("bet-type: no amount (set fixed or send feed)"); return done(); }
                    amount   = Number(fed.amount);
                    unitType = fed.unitType || "units";
                }

                msg.recipe = msg.recipe || { steps: [] };
                const step = { type: kind, amount, unitType };
                if (number !== undefined && !Number.isNaN(number)) step.number = number;
                if (betId) step.betId = betId;
                if (note)  step.note  = note;

                msg.recipe.steps.push(step);
                node.status({fill:"green", shape:"dot", text:`${kind}${step.number? " "+step.number:""}: ${amount} ${unitType}`});
                send(msg); done();
            } catch (err) { done(err); }
        });
    }
    RED.nodes.registerType("bet-type", BetTypeNode);
}
