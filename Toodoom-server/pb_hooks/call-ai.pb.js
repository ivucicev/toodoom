/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/organize-list/{id}", (e) => {

    let listId = e.request.pathValue("id");
    let userId = e.auth.id;

    const tasks = arrayOf(new DynamicModel({ list: "", position: 0, tags: "", done: false, title: "", id: "" }));

    $app.db()
        .newQuery(`SELECT id, list, tags, done, position, title FROM tasks WHERE done = 0 AND [list]={:list}`)
        .bind({ list: listId })
        .all(tasks);

    $app.logger().error(tasks);

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
            instructions: `You are an AI helper. You will get list of tasks, and you should sort them logically, and add tags for example you get list apples, meat, flip flops, bananas, t-shirt, should be sorted as apples #food, bananas #food, meat #food, flip-flops #clothes, t-shirt #clothes. To order them change position in given object. Do not change task text. Return same array but with given position. Tags add to Tags array comma separated example Apples tags: ["fruit", "food"], but leave existing. Return ONLY object that was sent.`,
            input: [...msgs]
        })
    });

    let textChunks = res.json.output
        ?.flatMap(o => o.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text);

    let responseMessage = textChunks[0];

    const updated = JSON.parse(responseMessage);

    updated.forEach(task => {
        $app.db().update('tasks', { tags: task.tags, position: task.position },
            $dbx.exp(`"id" = {:id}`, { id: task.id }))
            .execute();
    });

    return e.json(200, { "message": 'ok' });
})