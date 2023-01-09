import {ConversationEntryTypeRef, Mail, MailTypeRef} from "../../api/entities/tutanota/TypeRefs.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { CreateMailViewerOptions } from "./MailViewer.js"
import {elementIdPart, getElementId, isSameId, listIdPart} from "../../api/common/utils/EntityUtils.js"
import {assertNotNull, groupBy, isNotNull} from "@tutao/tutanota-utils"
import m from "mithril"
import {EntityClient} from "../../api/common/EntityClient.js"
import {LoadingStateTracker} from "../../offline/LoadingState.js"

export type MailViewerViewModelFactory = (options: CreateMailViewerOptions) => MailViewerViewModel

export class ConversationViewModel {
	private readonly _primaryViewModel: MailViewerViewModel

	private loadingState = new LoadingStateTracker()

	constructor(
		private options: CreateMailViewerOptions,
		private readonly viewModelFactory: MailViewerViewModelFactory,
		private readonly entityClient: EntityClient,
	) {
		this._primaryViewModel = viewModelFactory(options)
		// FIXME: shouldn't do it in constructor
		this.loadingState.trackPromise(this.loadConversation())
	}

	conversation: MailViewerViewModel[] | null = null

	private async loadConversation() {
		const conversationEntries = await this.entityClient.loadAll(ConversationEntryTypeRef, listIdPart(this.mail.conversationEntry))
		const byList = groupBy(conversationEntries, c => c.mail && listIdPart(c.mail))
		const allMails: Map<Id, Mail> = new Map()
		for (const [listId, conversations] of byList.entries()) {
			const loaded = await this.entityClient.loadMultiple(MailTypeRef, listId,  conversations. map(c => elementIdPart(assertNotNull(c.mail))))
			for (const mail of loaded) {
				allMails.set(getElementId(mail), mail)
			}
		}
		this.conversation = conversationEntries.map((c) => allMails.get(elementIdPart(assertNotNull(c.mail)))).filter(isNotNull)
											   .map((mail) => isSameId(mail._id, this.options.mail._id) ? this._primaryViewModel : this.viewModelFactory({...this.options, mail}))
		m.redraw()
	}

	viewModels(): ReadonlyArray<MailViewerViewModel> {
		return this.conversation ?? [this._primaryViewModel]
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
		for (const viewModel of this.viewModels()) {
			viewModel.dispose()
		}
	}
}