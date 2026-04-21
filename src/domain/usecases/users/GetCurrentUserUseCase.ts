import { User } from "$/domain/entities/User";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { UserRepository } from "$/domain/repositories/UserRepository";

export class GetCurrentUserUseCase {
    constructor(private options: { userRepository: UserRepository }) {}

    public execute(): FutureData<User> {
        return this.options.userRepository.getCurrent();
    }
}
