-- AlterTable
ALTER TABLE `Todo` ADD COLUMN `listId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TaskList` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `TaskList_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Todo_listId_idx` ON `Todo`(`listId`);

-- AddForeignKey
ALTER TABLE `TaskList` ADD CONSTRAINT `TaskList_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Todo` ADD CONSTRAINT `Todo_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `TaskList`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
