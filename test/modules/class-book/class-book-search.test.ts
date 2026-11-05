import { describe, expect, test, vi } from "vitest";
import { ClassBookService } from "../../../src/modules/class-book/class-book.service";
import { ClassBookFactory } from "../../../src/modules/class-book/class-book.factory";
import { CurriculumFactory } from "../../../src/modules/curriculums/curriculum.factory";
import { IClassBookRepository } from "../../../src/modules/class-book/domain/class-book.repository";

function setup() {
  const repository = {
    getClassBooks: vi.fn(async () => []),
    countClassBooks: vi.fn(async () => 0),
  };
  const service = new ClassBookService(
    repository as unknown as IClassBookRepository,
    new ClassBookFactory(new CurriculumFactory()),
    {} as never,
  );
  return { service, repository };
}

const expectSearchSentToRepository = async (
  search: string,
  expected: string | undefined,
  searchBy = "classof",
) => {
  const { service, repository } = setup();
  await service.getClassBooks({ page: 1, pageSize: 12, searchBy, search });
  const expectedQuery = expect.objectContaining({ search: expected });
  expect(repository.getClassBooks).toHaveBeenCalledWith(expectedQuery);
  expect(repository.countClassBooks).toHaveBeenCalledWith(expectedQuery);
};

describe("ClassBookService.getClassBooks classof search", () => {
  test.each([
    ["รุ่น 26", "26"],
    ["รุ่น26", "26"],
    ["รุ่นที่ 26", "26"],
    ["  รุ่น   26  ", "26"],
    ["26", "26"],
  ])("search %j is sent to the repository as %j", async (input, expected) => {
    await expectSearchSentToRepository(input, expected);
  });

  test("search with only the word รุ่น shows every class", async () => {
    await expectSearchSentToRepository("รุ่น", undefined);
  });

  test("does not change searches on other fields", async () => {
    await expectSearchSentToRepository("รุ่น 26", "รุ่น 26", "firstYearAcademic");
  });
});
