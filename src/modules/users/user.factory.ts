import { User, UserDTO, UserProfileDTO } from "./domain/user";

export interface IUserFactory {
  mapUserToDTO(user: User): UserDTO;
  mapUserListToDTO(users: User[]): UserDTO[];
  mapUserToProfileDTO(user: User): UserProfileDTO;
}

export class UserFactory implements IUserFactory {
  mapUserToDTO(user: User): UserDTO {
    return {
      id: user.id,
      prefix: user.prefix ?? null,
      firstNameTh: user.firstNameTh,
      lastNameTh: user.lastNameTh,
      firstNameEn: user.firstNameEn,
      lastNameEn: user.lastNameEn,
      email: user.email,
      nickName: user.nickName,
      imageUrl: user.imageMedia?.imageUrl ?? user.imageUrl,
      imageFocalPointX: user.imageFocalPointX ?? null,
      imageFocalPointY: user.imageFocalPointY ?? null,
    };
  }
  mapUserListToDTO(users: User[]): UserDTO[] {
    return users.map((user) => this.mapUserToDTO(user));
  }

  mapUserToProfileDTO(user: User): UserProfileDTO {
    return {
      ...this.mapUserToDTO(user),
      roles: (user.userRoles ?? []).map(({ role }) => ({
        id: role.id,
        name: role.name,
      })),
    };
  }
}
