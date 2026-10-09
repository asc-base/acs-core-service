import { describe, expect, test, vi } from "vitest";
import { ProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { ProfessorService } from "../../../src/modules/professors/professor.service";
import { ProfessorRepository } from "../../../src/infrastructure/profressor.repository";
import { ProfessorDocs } from "../../../src/modules/professors/professor.docs";
import { Elysia } from "elysia";

const professor = {
  id: 7,
  userID: 5,
  profRoom: "1/1",
  phone: "0123456789",
  expertFields: null,
  researchProfile: null,
  educations: [
    { id: 1, professorID: 7, sequence: 0, education: "ปริญญาเอก" },
    { id: 2, professorID: 7, sequence: 1, education: "ปริญญาโท" },
  ],
  user: { id: 5, prefix: null },
};

describe("professor education rows", () => {
  test("maps education rows to the existing ordered API array", () => {
    const factory = new ProfessorFactory({ mapUserToDTO: vi.fn((user) => user) } as never);

    expect(factory.mapProfessorToDTO(professor as never).professor.educations).toEqual([
      "ปริญญาเอก",
      "ปริญญาโท",
    ]);
  });

  test("splits and trims education values on create, retaining duplicates and order", async () => {
    const createProfessor = vi.fn(async (data) => ({ ...professor, educations: data.educations }));
    const service = new ProfessorService(
      { getProfessorByUserId: vi.fn(async () => null) } as never,
      { getUserByEmail: vi.fn(async () => null) } as never,
      { mapProfessorToDTO: vi.fn((value) => value) } as never,
      { upload: vi.fn(), delete: vi.fn() } as never,
      {
        runInTransaction: vi.fn(async (run) =>
          run({
            user: {
              createUser: vi.fn(async () => ({ id: 5 })),
              assignUserRole: vi.fn(),
            },
            professor: { createProfessor },
          }),
        ),
      } as never,
    );

    await service.createProfessor({
      firstNameTh: "ชื่อ",
      lastNameTh: "สกุล",
      email: "professor@example.test",
      prefixID: 1,
      phone: "0123456789",
      profRoom: "1/1",
      educations: "ปริญญาเอก// ปริญญาโท/ปริญญาเอก/",
    } as never);

    expect(createProfessor).toHaveBeenCalledWith(
      expect.objectContaining({ educations: ["ปริญญาเอก", "ปริญญาโท", "ปริญญาเอก"] }),
    );
  });

  test("preserves education rows when restoring a professor without the field", async () => {
    const updateProfessor = vi.fn(
      async (id: number, data: { educations?: string[] }) => {
        void id;
        void data;
        return professor;
      },
    );
    const service = new ProfessorService(
      { getProfessorByUserId: vi.fn(async () => ({ id: 7, userID: 5, deletedAt: new Date() })) } as never,
      { getUserByEmail: vi.fn(async () => ({ id: 5, userRoles: [{ roleID: 3 }] })) } as never,
      { mapProfessorToDTO: vi.fn((value) => value) } as never,
      { upload: vi.fn(), delete: vi.fn() } as never,
      {
        runInTransaction: vi.fn(async (run) =>
          run({
            user: { updateUser: vi.fn(async () => professor.user) },
            professor: { updateProfessor },
          }),
        ),
      } as never,
    );

    await service.createProfessor({
      firstNameTh: "ชื่อ",
      lastNameTh: "สกุล",
      email: "professor@example.test",
      prefixID: 1,
      phone: "0123456789",
      profRoom: "1/1",
    } as never);

    expect(updateProfessor.mock.calls[0][1]).not.toHaveProperty("educations");
  });

  test("clears education rows on null or an empty update value", async () => {
    const updateProfessor = vi.fn(
      async (id: number, data: { educations?: string[] }) => {
        void id;
        void data;
        return professor;
      },
    );
    const service = new ProfessorService(
      { getProfessorById: vi.fn(async () => professor) } as never,
      {} as never,
      { mapProfessorToDTO: vi.fn((value) => value) } as never,
      { upload: vi.fn(), delete: vi.fn() } as never,
      {
        runInTransaction: vi.fn(async (run) =>
          run({
            user: { updateUser: vi.fn(async () => professor.user) },
            professor: { updateProfessor },
          }),
        ),
      } as never,
    );

    await service.updateProfessor(5, { educations: null } as never);
    await service.updateProfessor(5, { educations: "" } as never);

    expect(updateProfessor.mock.calls[0][1].educations).toEqual([]);
    expect(updateProfessor.mock.calls[1][1].educations).toEqual([]);
  });

  test("an education-only update skips the unchanged user row", async () => {
    const educationText = "B.Sc., Sirindhorn International Institute of Technology, Thailand";
    const userUpdate = vi.fn(async () => professor.user);
    const professorUpdate = vi.fn(async (_id: number, data: { educations?: string[] }) => ({
      ...professor,
      ...(data.educations && {
        educations: data.educations.map((education, sequence) => ({
          id: sequence + 1,
          professorID: professor.id,
          sequence,
          education,
        })),
      }),
    }));
    const service = new ProfessorService(
      { getProfessorById: vi.fn(async () => professor) } as never,
      {} as never,
      { mapProfessorToDTO: vi.fn((value) => value) } as never,
      { upload: vi.fn(), delete: vi.fn() } as never,
      {
        runInTransaction: vi.fn(async (run) =>
          run({
            user: { updateUser: userUpdate },
            professor: { updateProfessor: professorUpdate },
          }),
        ),
      } as never,
    );

    await service.updateProfessor(7, { educations: educationText });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(professorUpdate).toHaveBeenCalledWith(7, {
      educations: [educationText],
    });
  });

  test("keeps commas inside one education entry intact", () => {
    const body = { educations: "B.Sc., Sirindhorn International Institute of Technology, Thailand" };

    ProfessorDocs.updateProfessor.transform({ body: body as never });

    expect(body.educations).toBe(
      "B.Sc., Sirindhorn International Institute of Technology, Thailand",
    );
  });

  test("keeps an explicitly empty education value so it clears the list", () => {
    const body = { educations: "" };

    ProfessorDocs.updateProfessor.transform({ body: body as never });

    expect(body.educations).toBe("");
  });

  test("preserves commas and empty values through multipart API parsing", async () => {
    const { body, transform, params } = ProfessorDocs.updateProfessor;
    const app = new Elysia().patch(
      "/professors/:id",
      ({ body }) => body,
      { body, transform, params },
    );
    const form = new FormData();
    form.append(
      "educations",
      "B.Sc., Sirindhorn International Institute of Technology, Thailand",
    );
    const response = await app.handle(
      new Request("http://localhost/professors/7", {
        method: "PATCH",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      educations: "B.Sc., Sirindhorn International Institute of Technology, Thailand",
    });
  });

  test("keeps an empty multipart education value for the service to clear", async () => {
    const { body, transform, params } = ProfessorDocs.updateProfessor;
    const app = new Elysia().patch(
      "/professors/:id",
      ({ body }) => body,
      { body, transform, params },
    );
    const form = new FormData();
    form.append("educations", "");
    const response = await app.handle(
      new Request("http://localhost/professors/7", {
        method: "PATCH",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ educations: "" });
  });

  test("replaces rows with a stable sequence and leaves them untouched when omitted", async () => {
    type UpdateArgs = {
      data: {
        educations?: {
          deleteMany: Record<string, never>;
          create: Array<{ education: string; sequence: number }>;
        };
      };
    };
    const update = vi.fn(async (args: UpdateArgs) => {
      void args;
      return professor;
    });
    const db = {
      professor: { update },
    } as never;
    const repository = new ProfessorRepository(db);

    await repository.updateProfessor(7, {
      educations: ["PhD", "MSc"],
    } as never);
    await repository.updateProfessor(7, { educations: [] } as never);
    await repository.updateProfessor(7, {} as never);

    expect(update.mock.calls[0][0].data.educations).toEqual({
      deleteMany: {},
      create: [
        { education: "PhD", sequence: 0 },
        { education: "MSc", sequence: 1 },
      ],
    });
    expect(update.mock.calls[1][0].data.educations).toEqual({
      deleteMany: {},
      create: [],
    });
    expect(update.mock.calls[2][0].data).not.toHaveProperty("educations");
  });

  test("creates rows with ordered sequence numbers", async () => {
    type CreateArgs = {
      data: { educations: { create: Array<{ education: string; sequence: number }> } };
      include: { educations: { orderBy: { sequence: "asc" } } };
    };
    const create = vi.fn(async (args: CreateArgs) => {
      void args;
      return professor;
    });
    const repository = new ProfessorRepository({ professor: { create } } as never);

    await repository.createProfessor({ educations: ["PhD", "MSc"] } as never);

    expect(create.mock.calls[0][0].data.educations.create).toEqual([
      { education: "PhD", sequence: 0 },
      { education: "MSc", sequence: 1 },
    ]);
    expect(create.mock.calls[0][0].include.educations.orderBy).toEqual({
      sequence: "asc",
    });
  });

  test("loads education rows in sequence order for professor lists and details", async () => {
    const findMany = vi.fn(async () => []);
    const findUniqueView = vi.fn(async () => null);
    const repository = new ProfessorRepository({
      userProfessorView: {
        findMany,
        findUnique: findUniqueView,
        count: vi.fn(async () => 0),
      },
    } as never);

    await repository.getProfessors({});
    await repository.getProfessorById(5);

    const orderedEducation = { orderBy: { sequence: "asc" } };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          professor: { include: { educations: orderedEducation } },
        }),
      }),
    );
    expect(findUniqueView).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          professor: { include: { educations: orderedEducation } },
        }),
      }),
    );
  });
});
