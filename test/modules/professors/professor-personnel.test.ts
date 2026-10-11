import { Elysia } from "elysia";
import { describe, expect, test, vi } from "vitest";
import { ProfessorRepository } from "../../../src/infrastructure/profressor.repository";
import { ProfessorDocs } from "../../../src/modules/professors/professor.docs";
import { ProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { ProfessorService } from "../../../src/modules/professors/professor.service";

describe("professor personnel", () => {
  test.each([
    undefined,
    "CURRICULUM_HEAD",
    "LECTURER",
    "CURRICULUM_STAFF",
    "ADMIN",
  ])(
    "validates optional multipart personnel type %s",
    async (personnelType) => {
      const { body, transform, params } = ProfessorDocs.updateProfessor;
      const app = new Elysia().patch("/professors/:id", ({ body }) => body, {
        body,
        transform,
        params,
      });
      const form = new FormData();
      form.set("phone", "0123456789");
      if (personnelType !== undefined) form.set("personnelType", personnelType);
      const response = await app.handle(
        new Request("http://localhost/professors/5", {
          method: "PATCH",
          body: form,
        }),
      );
      expect(response.status).toBe(personnelType === "ADMIN" ? 422 : 200);
      if (personnelType !== "ADMIN") {
        expect(await response.json()).toEqual({
          phone: "0123456789",
          ...(personnelType && { personnelType }),
        });
      }
    },
  );

  test.each<"academic" | "staff" | undefined>([undefined, "academic", "staff"])(
    "uses the same group filter for rows and count: %s",
    async (personnelGroup) => {
      const findMany = vi.fn(async () => []);
      const count = vi.fn(async () => 0);
      const repository = new ProfessorRepository({
        userProfessorView: { findMany, count },
      } as never);
      await repository.getProfessors({ personnelGroup, page: 2, pageSize: 12 });
      await repository.countProfessors({ personnelGroup });
      const where =
        personnelGroup === "staff"
          ? { professor: { is: { personnelType: "CURRICULUM_STAFF" } } }
          : personnelGroup === "academic"
            ? {
                professor: {
                  is: {
                    OR: [
                      { personnelType: null },
                      {
                        personnelType: { in: ["CURRICULUM_HEAD", "LECTURER"] },
                      },
                    ],
                  },
                },
              }
            : {};
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 12, take: 12 }),
      );
      expect(count).toHaveBeenCalledWith({ where });
    },
  );

  test("combines personnel group and search filters", async () => {
    const findMany = vi.fn(async () => []);
    const repository = new ProfessorRepository({
      userProfessorView: { findMany },
    } as never);
    await repository.getProfessors({
      personnelGroup: "staff",
      search: "ชื่อ",
      searchBy: "firstNameTh",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { professor: { is: { personnelType: "CURRICULUM_STAFF" } } },
            { firstNameTh: { contains: "ชื่อ", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  test("stores personnel type on the professor without changing the user or clearing an omitted type", async () => {
    const professor = {
      id: 7,
      userID: 5,
      user: { id: 5 },
      personnelType: "CURRICULUM_HEAD",
    };
    const updateProfessor = vi.fn(async () => professor);
    const updateUser = vi.fn();
    const service = new ProfessorService(
      { getProfessorById: vi.fn(async () => professor) } as never,
      {} as never,
      { mapProfessorToDTO: vi.fn((value) => value) } as never,
      {} as never,
      {
        runInTransaction: vi.fn(async (run) =>
          run({ professor: { updateProfessor }, user: { updateUser } }),
        ),
      } as never,
    );
    await service.updateProfessor(5, { personnelType: "CURRICULUM_STAFF" });
    expect(updateProfessor).toHaveBeenLastCalledWith(7, {
      personnelType: "CURRICULUM_STAFF",
    });
    await service.updateProfessor(5, { phone: "0123456789" });
    expect(updateProfessor).toHaveBeenLastCalledWith(7, {
      phone: "0123456789",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  test.each([undefined, null, "CURRICULUM_HEAD"])(
    "returns the type for new and legacy profiles: %s",
    (personnelType) => {
      const factory = new ProfessorFactory({
        mapUserToDTO: vi.fn(() => ({})),
      } as never);
      const result = factory.mapProfessorToDTO({
        id: 7,
        personnelType,
        educations: [],
        user: {},
      } as never);
      expect(result.professor.personnelType).toBe(personnelType ?? null);
    },
  );
});
