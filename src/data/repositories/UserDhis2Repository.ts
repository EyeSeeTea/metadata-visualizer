import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import { Dhis2PayloadError, isRecord } from "$/data/dhis2-payload-guards";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { User } from "$/domain/entities/User";
import { UserRepository } from "$/domain/repositories/UserRepository";

export class UserDhis2Repository implements UserRepository {
    constructor(private dataEngine: DataEngine) {}

    public getCurrent(): FutureData<User> {
        const context = "UserDhis2Repository.getCurrent";
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
                .then(res => parseD2User(res, context))
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

function parseD2User(response: unknown, context: string): D2User {
    if (!isRecord(response) || !isRecord(response.me)) {
        throw new Dhis2PayloadError(`${context}: expected envelope with "me" object`);
    }
    const me = response.me;
    const id = me.id;
    const displayName = me.displayName;
    if (typeof id !== "string" || typeof displayName !== "string") {
        throw new Dhis2PayloadError(`${context}: "me" is missing id/displayName`);
    }
    const userGroups = parseNamedRefs(me.userGroups, `${context}.me.userGroups`);
    const userCredentials = parseUserCredentials(
        me.userCredentials,
        `${context}.me.userCredentials`
    );
    return { id, displayName, userGroups, userCredentials };
}

function parseNamedRefs(value: unknown, context: string): Array<{ id: string; name: string }> {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw new Dhis2PayloadError(`${context}: expected array`);
    }
    return value.map((entry, index) => {
        if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.name !== "string") {
            throw new Dhis2PayloadError(`${context}[${index}]: expected {id, name}`);
        }
        return { id: entry.id, name: entry.name };
    });
}

function parseUserCredentials(value: unknown, context: string): D2User["userCredentials"] {
    if (!isRecord(value)) {
        throw new Dhis2PayloadError(`${context}: expected object`);
    }
    const { username, userRoles } = value;
    if (typeof username !== "string") {
        throw new Dhis2PayloadError(`${context}.username: expected string`);
    }
    if (!Array.isArray(userRoles)) {
        throw new Dhis2PayloadError(`${context}.userRoles: expected array`);
    }
    const parsedRoles = userRoles.map((role, index) => {
        if (
            !isRecord(role) ||
            typeof role.id !== "string" ||
            typeof role.name !== "string" ||
            !Array.isArray(role.authorities)
        ) {
            throw new Dhis2PayloadError(
                `${context}.userRoles[${index}]: expected {id, name, authorities[]}`
            );
        }
        const authorities = role.authorities.map((auth, authIndex) => {
            if (typeof auth !== "string") {
                throw new Dhis2PayloadError(
                    `${context}.userRoles[${index}].authorities[${authIndex}]: expected string`
                );
            }
            return auth;
        });
        return { id: role.id, name: role.name, authorities };
    });
    return { username, userRoles: parsedRoles };
}
