import { User } from "$/domain/entities/User";
import { FutureData } from "$/domain/entities/generic/FutureData";

export interface UserRepository {
    getCurrent(): FutureData<User>;
}
