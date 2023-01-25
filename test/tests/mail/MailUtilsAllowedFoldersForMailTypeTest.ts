import o from "ospec"
import { createMail, createMailFolder, Mail, MailFolder } from "../../../src/api/entities/tutanota/TypeRefs.js"
import { getMailFolderType, MailFolderType, MailState } from "../../../src/api/common/TutanotaConstants.js"
import { allMailsAllowedInsideFolder, getMailMoveTargets, mailStateAllowedInsideFolderType } from "../../../src/mail/model/MailUtils.js"
import { MailboxDetail, MailModel } from "../../../src/mail/model/MailModel.js"
import { matchers, object, when } from "testdouble"
import { FolderSystem } from "../../../src/api/common/mail/FolderSystem.js"
import { isSameTypeRef } from "@tutao/tutanota-utils"
import no from "../../../src/translations/no.js"

function createMailOfStateInFolder(mailState: MailState, folderId: Id): Mail {
	return createMail({ _id: [folderId, "mailId"], state: mailState })
}

function createMailFolderOfType(folderType: MailFolderType): MailFolder {
	return createMailFolder({
		_id: ["folderlistId", "folderId"],
		folderType: folderType,
		mails: folderType,
	})
}

o.spec("MailUtilsAllowedFoldersForMailTypeTest", function () {
	const draftMail = [createMailOfStateInFolder(MailState.DRAFT, MailFolderType.DRAFT), createMailOfStateInFolder(MailState.DRAFT, MailFolderType.TRASH)]
	const receivedMail = [
		createMailOfStateInFolder(MailState.RECEIVED, MailFolderType.INBOX),
		createMailOfStateInFolder(MailState.RECEIVED, MailFolderType.CUSTOM),
	]
	const allMail = [...draftMail, ...receivedMail]
	const emptyMail = []

	const customFolder = createMailFolderOfType(MailFolderType.CUSTOM)
	const inboxFolder = createMailFolderOfType(MailFolderType.INBOX)
	const sentFolder = createMailFolderOfType(MailFolderType.SENT)
	const trashFolder = createMailFolderOfType(MailFolderType.TRASH)
	const archiveFolder = createMailFolderOfType(MailFolderType.ARCHIVE)
	const spamFolder = createMailFolderOfType(MailFolderType.SPAM)
	const draftFolder = createMailFolderOfType(MailFolderType.DRAFT)
	const allFolders = [customFolder, inboxFolder, sentFolder, trashFolder, archiveFolder, spamFolder, draftFolder]

	let mailModelMock: MailModel
	let mailboxDetailMock: Partial<MailboxDetail>
	let otherMailboxDetailMock: Partial<MailboxDetail>

	o.beforeEach(function () {
		mailModelMock = object()
		mailboxDetailMock = {
			folders: new FolderSystem(allFolders),
		}
		otherMailboxDetailMock = {
			folders: new FolderSystem([createMailFolderOfType(MailFolderType.INBOX)]),
		}
		when(mailModelMock.getMailboxDetailsForMailSync(matchers.argThat((mail) => allMail.includes(mail)))).thenReturn(mailboxDetailMock)
		when(mailModelMock.getMailboxDetailsForMailSync(matchers.argThat((mail) => !allMail.includes(mail)))).thenReturn(otherMailboxDetailMock)
	})

	o("drafts can go in drafts but not inbox", function () {
		o(allMailsAllowedInsideFolder(draftMail, draftFolder)).equals(true)
		o(allMailsAllowedInsideFolder(draftMail, trashFolder)).equals(true)

		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.DRAFT)).equals(true)
		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.TRASH)).equals(true)

		o(allMailsAllowedInsideFolder(draftMail, inboxFolder)).equals(false)
		o(allMailsAllowedInsideFolder(draftMail, sentFolder)).equals(false)
		o(allMailsAllowedInsideFolder(draftMail, spamFolder)).equals(false)
		o(allMailsAllowedInsideFolder(draftMail, customFolder)).equals(false)
		o(allMailsAllowedInsideFolder(draftMail, archiveFolder)).equals(false)

		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.CUSTOM)).equals(false)
		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.INBOX)).equals(false)
		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.SENT)).equals(false)
		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.ARCHIVE)).equals(false)
		o(mailStateAllowedInsideFolderType(MailState.DRAFT, MailFolderType.SPAM)).equals(false)
	})

	o("non-drafts cannot go in drafts but other folders", function () {
		o(allMailsAllowedInsideFolder(receivedMail, inboxFolder)).equals(true)
		o(allMailsAllowedInsideFolder(receivedMail, sentFolder)).equals(true)
		o(allMailsAllowedInsideFolder(receivedMail, spamFolder)).equals(true)
		o(allMailsAllowedInsideFolder(receivedMail, customFolder)).equals(true)
		o(allMailsAllowedInsideFolder(receivedMail, archiveFolder)).equals(true)
		o(allMailsAllowedInsideFolder(receivedMail, trashFolder)).equals(true)

		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.TRASH)).equals(true)
		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.CUSTOM)).equals(true)
		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.INBOX)).equals(true)
		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.SENT)).equals(true)
		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.ARCHIVE)).equals(true)
		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.SPAM)).equals(true)

		o(allMailsAllowedInsideFolder(receivedMail, draftFolder)).equals(false)

		o(mailStateAllowedInsideFolderType(MailState.RECEIVED, MailFolderType.DRAFT)).equals(false)
	})

	o("combined drafts and non-drafts only go in trash", function () {
		o(allMailsAllowedInsideFolder(allMail, trashFolder)).equals(true)

		o(allMailsAllowedInsideFolder(allMail, inboxFolder)).equals(false)
		o(allMailsAllowedInsideFolder(allMail, sentFolder)).equals(false)
		o(allMailsAllowedInsideFolder(allMail, spamFolder)).equals(false)
		o(allMailsAllowedInsideFolder(allMail, customFolder)).equals(false)
		o(allMailsAllowedInsideFolder(allMail, archiveFolder)).equals(false)
	})

	o("empty mail can go anywhere", function () {
		o(allMailsAllowedInsideFolder(emptyMail, trashFolder)).equals(true)
		o(allMailsAllowedInsideFolder(emptyMail, inboxFolder)).equals(true)
		o(allMailsAllowedInsideFolder(emptyMail, sentFolder)).equals(true)
		o(allMailsAllowedInsideFolder(emptyMail, spamFolder)).equals(true)
		o(allMailsAllowedInsideFolder(emptyMail, customFolder)).equals(true)
		o(allMailsAllowedInsideFolder(emptyMail, archiveFolder)).equals(true)
	})

	o.spec("two mails from separate mailboxes can't be moved together", function () {
		o("received mail from other mailbox", function () {
			const possibleFolders = getMailMoveTargets(mailModelMock, [...allMail, ...[createMailOfStateInFolder(MailState.RECEIVED, MailFolderType.INBOX)]])
			o(possibleFolders.length).equals(0)
		})
		o("draft from other mailbox", function () {
			const possibleFolders = getMailMoveTargets(mailModelMock, [...allMail, ...[createMailOfStateInFolder(MailState.DRAFT, MailFolderType.DRAFT)]])
			o(possibleFolders.length).equals(0)
		})
		o("sent mail from other mailbox", function () {
			const noPossibleFoldersSent = getMailMoveTargets(mailModelMock, [...allMail, ...[createMailOfStateInFolder(MailState.SENT, MailFolderType.SENT)]])
			o(noPossibleFoldersSent.length).equals(0)
		})
	})

	o("draft and received email can be moved to trash", function () {
		const possibleFolders = getMailMoveTargets(mailModelMock, allMail)
		o(possibleFolders.length).equals(1)
		o(possibleFolders.map((folderInfo) => folderInfo.folder)).deepEquals([trashFolder])
	})

	o("draft in drafts and draft in trash can be moved together to both drafts and trash", function () {
		const possibleFolders = getMailMoveTargets(mailModelMock, draftMail)
		o(possibleFolders.length).equals(2)
		o(possibleFolders.every((folderInfo) => [trashFolder, draftFolder].includes(folderInfo.folder))).equals(true)
	})

	o("received emails in different folders can be moved to every folder even if already contained in the list except for drafts", function () {
		const possibleFolders = getMailMoveTargets(mailModelMock, receivedMail)
		const foldersWithoutDraft = allFolders.filter((folder) => folder.folderType !== MailFolderType.DRAFT)
		o(possibleFolders.length).equals(allFolders.length - 1)
		o(
			possibleFolders.every((folderInfo) => {
				return foldersWithoutDraft.includes(folderInfo.folder) && folderInfo.folder.folderType !== MailFolderType.DRAFT
			}),
		).equals(true)
	})
})
