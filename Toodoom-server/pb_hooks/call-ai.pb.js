/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/organize-list/{id}", (e) => {

    let id = e.request.pathValue("id");
    let userId = e.auth.id;
    
    const invite = new DynamicModel({
        list: "",
        id: ""
    });
    
    $app.db()
    .newQuery(`SELECT id, list FROM invites WHERE id={:id}`)
    .bind({ "id": id }).one(invite);

    let listId = invite.list;
    
    $app.logger().info(`Accepting invite id: ${id} for userId: ${userId}`);

    $app.db().delete('invites', $dbx.and($dbx.exp(`id = {:id}`, { id: id }), $dbx.exp(`list = {:listId}`, { listId: listId }))).execute();

    $app.logger().info(`Deleted invitation with id: ${id}`);

    const list = new DynamicModel({
        participants: "",
        id: ""
    });

    $app.db()
        .newQuery(`SELECT id, participants FROM lists WHERE id={:listId}`)
        .bind({ "listId": listId }).one(list);

    let participants = [];
    if (list && Array.isArray(list.participants)) {
        participants = list.participants;
    } else if (list && typeof list.participants === 'string') {
        try {
            participants = JSON.parse(list.participants);
        } catch {
            participants = [];
        }
    }

    // Add userId if not already present
    if (!participants.includes(userId)) {
        participants.push(userId);
    }

    // Update the participants array in the database
    $app.db().update('lists', { participants: JSON.stringify(participants) },
        $dbx.and($dbx.exp(`"id" = {:listId}`, { listId: listId })))
        .execute();

    return e.json(200, { "message": "ok" });
})