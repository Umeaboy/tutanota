import { ConversationEntry, ConversationEntryTypeRef, Mail, MailTypeRef } from "../../api/entities/tutanota/TypeRefs.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { CreateMailViewerOptions } from "./MailViewer.js"
import { elementIdPart, getElementId, haveSameId, isSameId, listIdPart } from "../../api/common/utils/EntityUtils.js"
import { assertNotNull, groupBy } from "@tutao/tutanota-utils"
import { EntityClient } from "../../api/common/EntityClient.js"
import { LoadingStateTracker } from "../../offline/LoadingState.js"
import { EntityEventsListener, EntityUpdateData, EventController, isUpdateForTypeRef } from "../../api/main/EventController.js"
import { ConversationType, OperationType } from "../../api/common/TutanotaConstants.js"
import { NotFoundError } from "../../api/common/error/RestError.js"

export type MailViewerViewModelFactory = (options: CreateMailViewerOptions) => MailViewerViewModel

export type MailItem = { type: "mail"; viewModel: MailViewerViewModel }
export type UnknownItem = { type: "deleted"; entry: ConversationEntry }
export type ConversationItem = MailItem | UnknownItem

export class ConversationViewModel {
	private readonly _primaryViewModel: MailViewerViewModel

	private loadingState = new LoadingStateTracker()
	private loadingPromise: Promise<void>

	constructor(
		private options: CreateMailViewerOptions,
		private readonly viewModelFactory: MailViewerViewModelFactory,
		private readonly entityClient: EntityClient,
		private readonly eventController: EventController,
		private readonly onUiUpdate: () => unknown,
	) {
		this._primaryViewModel = viewModelFactory(options)
		// FIXME: shouldn't do it in constructor
		this.loadingPromise = this.loadingState.trackPromise(this.loadConversation())
		this.eventController.addEntityListener(this.onEntityEvent)
	}

	private readonly onEntityEvent: EntityEventsListener = async (updates, eventOwnerGroupId) => {
		// conversation entry can be created when new email arrives
		// conversation entry can be updated when email is moved around or deleted
		// conversation entry is deleted only when the whole mail list is deleted
		for (const update of updates) {
			if (isUpdateForTypeRef(ConversationEntryTypeRef, update) && update.instanceListId === this.conversationListId()) {
				switch (update.operation) {
					case OperationType.CREATE:
						await this.processCreateConversationEntry(update)
						break
					case OperationType.UPDATE:
						await this.processUpdateConversationEntry(update)
						break
				}
			}
		}
	}

	private async processCreateConversationEntry(update: EntityUpdateData) {
		// FIXME this is very WIP, no error handling, many assumptions
		const id: IdTuple = [update.instanceListId, update.instanceId]
		const entry = await this.entityClient.load(ConversationEntryTypeRef, id)
		if (entry.mail) {
			try {
				// first wait that we load the conversation, otherwise we might already have the email
				await this.loadingPromise
			} catch (e) {
				return
			}
			const conversation = assertNotNull(this.conversation)
			if (conversation.some((item) => item.type === "mail" && isSameId(item.viewModel.mail.conversationEntry, id))) {
				// already loaded
				return
			}
			try {
				const mail = await this.entityClient.load(MailTypeRef, entry.mail)
				// FIXME: find the place for it
				conversation.push({ type: "mail", viewModel: this.viewModelFactory({ ...this.options, mail }) })
				this.onUiUpdate()
			} catch (e) {
				if (e instanceof NotFoundError) {
				} else {
					throw e
				}
			}
		}
	}

	private async processUpdateConversationEntry(update: EntityUpdateData) {
		// FIXME for now
		if (!this.conversation) return
		const ceId: IdTuple = [update.instanceListId, update.instanceId]
		const conversationEntry = await this.entityClient.load(ConversationEntryTypeRef, ceId)
		const mail =
			// ideally checking the `mail` ref should be enough but we sometimes get an update with UNKNOWN and non-existing email but still with the ref
			conversationEntry.conversationType !== ConversationType.UNKNOWN && conversationEntry.mail
				? await this.entityClient.load(MailTypeRef, conversationEntry.mail)
				: null
		const oldItemIndex = this.conversation.findIndex(
			(e) => (e.type === "mail" && isSameId(e.viewModel.mail.conversationEntry, ceId)) || (e.type === "deleted" && isSameId(e.entry._id, ceId)),
		)
		if (oldItemIndex === -1) {
			return
		}
		const oldItem = this.conversation[oldItemIndex]
		if (mail && oldItem.type === "mail" && haveSameId(oldItem.viewModel.mail, mail)) {
			console.log("Noop entry update?", oldItem.viewModel.mail)
			// nothing to do really, why do we get this update again?
		} else {
			if (oldItem.type === "mail") {
				oldItem.viewModel.dispose()
			}
			if (mail) {
				this.conversation[oldItemIndex] = {
					type: "mail",
					viewModel: this.viewModelFactory({ ...this.options, mail }),
				}
			} else {
				this.conversation[oldItemIndex] = { type: "deleted", entry: conversationEntry }
			}
		}
	}

	private conversationListId() {
		return listIdPart(this._primaryViewModel.mail.conversationEntry)
	}

	conversation: ConversationItem[] | null = null

	private async loadConversation() {
		const conversationEntries = await this.entityClient.loadAll(ConversationEntryTypeRef, listIdPart(this.mail.conversationEntry))
		const byList = groupBy(conversationEntries, (c) => c.mail && listIdPart(c.mail))
		const allMails: Map<Id, Mail> = new Map()
		for (const [listId, conversations] of byList.entries()) {
			if (!listId) continue
			const loaded = await this.entityClient.loadMultiple(
				MailTypeRef,
				listId,
				conversations.map((c) => elementIdPart(assertNotNull(c.mail))),
			)
			for (const mail of loaded) {
				allMails.set(getElementId(mail), mail)
			}
		}
		this.conversation = conversationEntries.map((c) => {
			const mail = c.mail && allMails.get(elementIdPart(c.mail))
			return mail
				? {
						type: "mail",
						viewModel: isSameId(mail._id, this.options.mail._id) ? this._primaryViewModel : this.viewModelFactory({ ...this.options, mail }),
				  }
				: { type: "deleted", entry: c }
		})
		this.onUiUpdate()
	}

	entries(): ReadonlyArray<ConversationItem> {
		return this.conversation ?? [{ type: "mail", viewModel: this._primaryViewModel }]
	}

	get mail(): Mail {
		return this._primaryViewModel.mail
	}

	primaryViewModel(): MailViewerViewModel {
		return this._primaryViewModel
	}

	isFinished(): boolean {
		return this.loadingState.isIdle()
	}

	isConnectionLost(): boolean {
		return this.loadingState.isConnectionLost()
	}

	dispose() {
		for (const item of this.entries()) {
			if (item.type === "mail") {
				item.viewModel.dispose()
			}
		}
	}
}
