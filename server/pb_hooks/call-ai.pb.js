/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/organize-list/{id}", (e) => {

    let listId = e.request.pathValue("id");
    let userId = e.auth.id;

    const tasks = arrayOf(new DynamicModel({ list: "", position: 0, tags: "", done: false, title: "", id: "" }));

    $app.db()
        .newQuery(`SELECT id, list, tags, done, position, title FROM tasks WHERE done = 0 AND [list]={:list}`)
        .bind({ list: listId })
        .all(tasks);

    $app.logger().error(JSON.stringify(tasks));

    const msgs = [
        { role: "user", content: JSON.stringify(tasks) },
    ];

    const res = $http.send({
        url: "https://api.openai.com/v1/responses",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.OPENAI_API_KEY
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            instructions: `You are an AI helper. You will get a list of tasks and must ensure each task has a category tag, in the SAME LANGUAGE as the task text (e.g., Croatian tasks should get Croatian category tags). Use a single category tag per task plus keep existing tags. Then sort tasks by category (group all same-category together), and within each category sort alphabetically by title. Do not change task text or ids. Return JSON only.`,
            text: {
                format: {
                    type: "json_schema",
                    name: "organized_tasks",
                    schema: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            tasks: {
                                type: "array",
                                items: {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        id: { type: "string" },
                                        title: { type: "string" },
                                        tags: { type: "array", items: { type: "string" } }
                                    },
                                    required: ["id", "title", "tags"]
                                }
                            }
                        },
                        required: ["tasks"]
                    },
                    strict: true
                }
            },
            input: [...msgs]
        })
    });

    if (!res || (res.statusCode && res.statusCode >= 400)) {
        $app.logger().error("AI request failed:", JSON.stringify(res));
        return e.json(500, { message: "AI request failed." });
    }

    let textChunks = res.json.output
        ?.flatMap(o => o.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text);

    let responseMessage = textChunks?.[0];

    if (!responseMessage) {
        $app.logger().error("AI response missing output_text:", JSON.stringify(res.json));
        return e.json(500, { message: "No AI response received." });
    }

    let parsed;
    try {
        parsed = JSON.parse(responseMessage);
    } catch (err) {
        $app.logger().error("AI response JSON parse failed:", responseMessage);
        return e.json(500, { message: "AI returned invalid JSON." });
    }

    const updated = parsed.tasks || [];

    const alpha = (s) => String(s || "").toLowerCase().trim();
    const categoryFromTags = (task) => {
        const tags = Array.isArray(task.tags) ? task.tags : [];
        const normalized = tags.map(t => String(t).replace(/^#/, "").toLowerCase().trim());
        const primary = normalized.find(t => t && t !== "food");
        return primary || "misc";
    };

    const sorted = updated
        .filter(t => t && t.id)
        .sort((a, b) => {
            const aCat = categoryFromTags(a);
            const bCat = categoryFromTags(b);
            if (aCat !== bCat) return aCat.localeCompare(bCat);
            return alpha(a.title).localeCompare(alpha(b.title));
        });

    const normalizeTags = (tags) => {
        if (Array.isArray(tags)) {
            return JSON.stringify(tags);
        }
        if (typeof tags === "string") {
            return tags;
        }
        return JSON.stringify([]);
    };

    sorted.forEach((task, index) => {
        $app.db().update('tasks', { tags: normalizeTags(task.tags), position: index },
            $dbx.exp(`"id" = {:id}`, { id: task.id }))
            .execute();
    });

    return e.json(200, { "message": 'ok' });
})
