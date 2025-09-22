/// <reference path="../pb_data/types.d.ts" />


// ADD TRIGGER WHEN ADDING INVITE TRIGGER FUNCTION THAT WILL ADD USER TO THE LIST
routerAdd("GET", "/api/check-invites", (e) => {

    let userId = e.auth.id;
    let userEmail = e.auth.email();

    // Fetch all invites for the user
    const invites = arrayOf(new DynamicModel({ list: "", id: "" }));

    $app.db()
        .newQuery(`SELECT id, list FROM invites WHERE [to]={:email}`)
        .bind({ email: userEmail })
        .all(invites);

    if (!invites.length) {
        return e.json(200, { message: "no invites" });
    }

    invites.forEach(invite => {
        let inviteId = invite.id;
        let listId = invite.list;

        // Delete the invite
        $app.db().delete('invites', $dbx.and(
            $dbx.exp(`id = {:id}`, { id: inviteId }),
            $dbx.exp(`list = {:listId}`, { listId: listId })
        )).execute();

        // Fetch the list
        const list = new DynamicModel({ participants: "", id: "" });
        $app.db()
            .newQuery(`SELECT id, participants FROM lists WHERE id={:listId}`)
            .bind({ listId: listId }).one(list);

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
    });

    return e.json(200, { message: "ok", invitesProcessed: invites.length });
});

