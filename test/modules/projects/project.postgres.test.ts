import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PrismaClient } from "../../../src/generated/prisma/client";
import { ProjectRepository } from "../../../src/infrastructure/project.repository";
import type { PrismaInstance } from "../../../src/lib/db";

const databaseUrl = process.env.TEST_DATABASE_URL;
const postgresDescribe = databaseUrl ? describe : describe.skip;

postgresDescribe("Projects relations with PostgreSQL", () => {
  let pool: pg.Pool;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pool?.end();
  });

  test("commits a project and reorders its mixed gallery atomically", async () => {
    const suffix = randomUUID();
    const emailStudent = `project-student-${suffix}@example.test`;
    const emailProfessor = `project-professor-${suffix}@example.test`;
    const mediaPrefix = `https://project-test.invalid/${suffix}/`;
    const title = `Project ${suffix}`;
    const techStackName = `ProjectTech-${suffix}`;
    let curriculumID: number | undefined;
    let classBookID: number | undefined;
    let typeCourseID: number | undefined;
    let studentID: number | undefined;
    let professorID: number | undefined;
    let projectID: number | undefined;

    try {
      const curriculum = await prisma.curriculum.create({
        data: { title: `Curriculum ${suffix}`, year: suffix, documentURL: "", description: "test", thumbnailURL: "" },
      });
      curriculumID = curriculum.id;
      const classBook = await prisma.classBook.create({
        data: { classof: suffix, firstYearAcademic: "2026", thumbnailURL: "", curriculumID },
      });
      classBookID = classBook.id;
      const typeCourse = await prisma.typeCourse.create({ data: { type: `Type ${suffix}`, description: "test" } });
      typeCourseID = typeCourse.id;
      const studentUser = await prisma.user.create({
        data: { email: emailStudent, firstNameTh: "ผู้เรียน", lastNameTh: "ทดสอบ" },
      });
      studentID = studentUser.id;
      const professorUser = await prisma.user.create({
        data: { email: emailProfessor, firstNameTh: "อาจารย์", lastNameTh: "ทดสอบ" },
      });
      professorID = professorUser.id;
      await prisma.student.create({ data: { userID: studentID, classBookID, studentCode: suffix } });
      await prisma.professor.create({ data: { userID: professorID, profRoom: "1/1", phone: "0000000000" } });
      const course = await prisma.course.create({
        data: {
          courseCode: `TEST-${suffix}`,
          courseNameTh: "ทดสอบ",
          courseNameEn: "Test",
          detail: "Test course",
          credits: "1",
          typeCourseID,
          curriculumID,
        },
      });

      const repository = new ProjectRepository(prisma as unknown as PrismaInstance);
      const project = await repository.createProject({
        title,
        detail: "Project details",
        githubURL: "https://example.test/github",
        presentationURL: "https://example.test/presentation",
        documentURL: "https://example.test/document",
        figmaURL: null,
        youtubeURL: "https://example.test/youtube",
        courseIds: [course.id],
        fieldIds: [],
        categoryIds: [],
        projectTypeIds: [],
        techStacks: [techStackName, ` ${techStackName} `],
        members: [
          { userID: studentID, memberType: "STUDENT", position: "Developer" },
          { userID: professorID, memberType: "ADVISOR" },
        ],
        thumbnailMedia: { provider: "legacy_url", imageUrl: `${mediaPrefix}cover.png` },
        galleryImages: [
          { media: { provider: "legacy_url", imageUrl: `${mediaPrefix}first.png` } },
          { media: { provider: "legacy_url", imageUrl: `${mediaPrefix}second.png` } },
        ],
      });
      projectID = project.id;
      expect(project.projectMembers.map(({ memberType, position }) => ({ memberType, position }))).toEqual([
        { memberType: "STUDENT", position: "Developer" },
        { memberType: "ADVISOR", position: null },
      ]);
      expect(project.projectTechStacks.map(({ techStack }) => techStack.name)).toEqual([techStackName]);
      await expect(repository.getProject({
        courseID: [course.id],
        classBookID: [classBook.id],
        search: title,
      })).resolves.toHaveLength(1);

      await repository.updateProject(project.id, {
        members: [
          { userID: studentID, memberType: "STUDENT" },
          { userID: professorID, memberType: "ADVISOR" },
        ],
        galleryImages: [
          { imageID: project.images[1]!.imageID },
          { media: { provider: "legacy_url", imageUrl: `${mediaPrefix}middle.png` } },
          { imageID: project.images[0]!.imageID },
        ],
        updatedAt: new Date(),
      });
      const updated = await repository.getProjectById(project.id);
      expect(updated?.projectMembers.map(({ position }) => position)).toEqual([null, null]);
      expect(updated?.images.map(({ image, sortOrder }) => ({ imageUrl: image.imageUrl, sortOrder }))).toEqual([
        { imageUrl: `${mediaPrefix}second.png`, sortOrder: 0 },
        { imageUrl: `${mediaPrefix}middle.png`, sortOrder: 1 },
        { imageUrl: `${mediaPrefix}first.png`, sortOrder: 2 },
      ]);

      await expect(repository.createProject({
        title: `${title} invalid`,
        detail: "Will roll back",
        githubURL: "https://example.test/github",
        presentationURL: "https://example.test/presentation",
        documentURL: "https://example.test/document",
        youtubeURL: "https://example.test/youtube",
        courseIds: [99999999],
        fieldIds: [],
        categoryIds: [],
        projectTypeIds: [],
        techStacks: [techStackName],
        members: [
          { userID: studentID, memberType: "STUDENT" },
          { userID: professorID, memberType: "ADVISOR" },
        ],
        thumbnailMedia: { provider: "legacy_url", imageUrl: `${mediaPrefix}rollback-cover.png` },
        galleryImages: [{ media: { provider: "legacy_url", imageUrl: `${mediaPrefix}rollback-image.png` } }],
      })).rejects.toMatchObject({ statusCode: 400 });
      expect(await prisma.project.count({ where: { title: `${title} invalid` } })).toBe(0);
      expect(await prisma.imageMedia.count({ where: { imageUrl: { startsWith: `${mediaPrefix}rollback-` } } })).toBe(0);
    } finally {
      if (projectID) {
        await prisma.projectImage.deleteMany({ where: { projectID } });
        await prisma.projectMember.deleteMany({ where: { projectID } });
        await prisma.projectCourse.deleteMany({ where: { projectID } });
        await prisma.projectTechStack.deleteMany({ where: { projectID } });
        await prisma.project.deleteMany({ where: { id: projectID } });
      }
      if (professorID) {
        await prisma.professor.deleteMany({ where: { userID: professorID } });
        await prisma.user.deleteMany({ where: { id: professorID } });
      }
      if (studentID) {
        await prisma.student.deleteMany({ where: { userID: studentID } });
        await prisma.user.deleteMany({ where: { id: studentID } });
      }
      await prisma.imageMedia.deleteMany({ where: { imageUrl: { startsWith: mediaPrefix } } });
      if (curriculumID && typeCourseID) {
        await prisma.course.deleteMany({ where: { curriculumID } });
      }
      if (typeCourseID) await prisma.typeCourse.deleteMany({ where: { id: typeCourseID } });
      if (classBookID) await prisma.classBook.deleteMany({ where: { id: classBookID } });
      if (curriculumID) await prisma.curriculum.deleteMany({ where: { id: curriculumID } });
      await prisma.techStack.deleteMany({ where: { name: techStackName } });
    }
  }, 30000);
});
