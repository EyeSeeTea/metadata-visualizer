import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { User } from "$/domain/entities/User";
import { UserRepository } from "$/domain/repositories/UserRepository";

export class UserDhis2Repository implements UserRepository {
    constructor(private dataEngine: DataEngine) {}

    public getCurrent(): FutureData<User> {
        return promiseToFuture<D2User>(signal =>
            this.dataEngine
                .query(
                    {
                        me: {
                            resource: "me",
                            params: {
                                fields: "id,displayName,userGroups[id,name],userCredentials[username,userRoles[id,name,authorities]]",
                            },
                        },
                    },
                    { signal }
                )
                .then(res => (res as { me?: unknown }).me as D2User)
        ).map(d2User => this.buildUser(d2User));
    }

    private buildUser(d2User: D2User) {
        return new User({
            id: d2User.id,
            name: d2User.displayName,
            userGroups: d2User.userGroups,
            ...d2User.userCredentials,
        });
    }
}

type D2User = {
    id: string;
    displayName: string;
    userGroups: Array<{ id: string; name: string }>;
    userCredentials: {
        username: string;
        userRoles: Array<{ id: string; name: string; authorities: string[] }>;
    };
};
