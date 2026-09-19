import { PrismaClient } from "../../src/generated/prisma/client";

export const prefixes = [
  { sequence: 1, nameTh: "อาจารย์", shortTh: "อ.", nameEn: "Lecturer", shortEn: "Lect." },
  { sequence: 2, nameTh: "ผู้ช่วยศาสตราจารย์", shortTh: "ผศ.", nameEn: "Assistant Professor", shortEn: "Asst. Prof." },
  { sequence: 3, nameTh: "รองศาสตราจารย์", shortTh: "รศ.", nameEn: "Associate Professor", shortEn: "Assoc. Prof." },
  { sequence: 4, nameTh: "ศาสตราจารย์", shortTh: "ศ.", nameEn: "Professor", shortEn: "Prof." },
  { sequence: 5, nameTh: "ศาสตราจารย์เกียรติคุณ", shortTh: "ศ. เกียรติคุณ", nameEn: "Professor Emeritus", shortEn: "Prof. Emeritus" },
  { sequence: 6, nameTh: "ผู้ช่วยศาสตราจารย์ ดอกเตอร์", shortTh: "ผศ. ดร.", nameEn: "Assistant Professor Doctor", shortEn: "Asst. Prof. Dr." },
  { sequence: 7, nameTh: "ดอกเตอร์", shortTh: "ดร.", nameEn: "Doctor", shortEn: "Dr." },
  { sequence: 8, nameTh: "รองศาสตราจารย์ ดอกเตอร์", shortTh: "รศ. ดร.", nameEn: "Associate Professor Doctor", shortEn: "Assoc. Prof. Dr." },
  { sequence: 9, nameTh: "ศาสตราจารย์ ดอกเตอร์", shortTh: "ศ. ดร.", nameEn: "Professor Doctor", shortEn: "Prof. Dr." },
  { sequence: 10, nameTh: "นาย", shortTh: "นาย", nameEn: "", shortEn: "Mr." },
  { sequence: 11, nameTh: "นางสาว", shortTh: "นางสาว", nameEn: "", shortEn: "Miss" },
];

export const executeSeedPrefixes = async (prisma: PrismaClient) => {
  for (const prefix of prefixes) {
    await prisma.prefix.upsert({
      where: {
        sequence: prefix.sequence,
      },
      update: {
        nameTh: prefix.nameTh,
        nameEn: prefix.nameEn,
        shortNameTh: prefix.shortTh,
        shortNameEn: prefix.shortEn,
      },
      create: {
        sequence: prefix.sequence,
        nameTh: prefix.nameTh,
        nameEn: prefix.nameEn,
        shortNameTh: prefix.shortTh,
        shortNameEn: prefix.shortEn,
      },
    });
  }
};
