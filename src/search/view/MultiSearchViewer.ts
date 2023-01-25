import m, { Component } from "mithril"
import { assertMainOrNode, isApp } from "../../api/common/Env"
import { ActionBar } from "../../gui/base/ActionBar"
import { Icons } from "../../gui/base/icons/Icons"
import { lang } from "../../misc/LanguageViewModel"
import ColumnEmptyMessageBox from "../../gui/base/ColumnEmptyMessageBox"
import { SearchListView } from "./SearchListView"
import { NotFoundError } from "../../api/common/error/RestError"
import type { Contact, Mail } from "../../api/entities/tutanota/TypeRefs.js"
import { ContactTypeRef, MailTypeRef } from "../../api/entities/tutanota/TypeRefs.js"
import { Dialog } from "../../gui/base/Dialog"
import { getFolderIcon, getIndentedFolderNameForDropdown, getMailMoveTargets, markMails } from "../../mail/model/MailUtils"
import { showProgressDialog } from "../../gui/dialogs/ProgressDialog"
import { mergeContacts } from "../../contacts/ContactMergeUtils"
import { logins } from "../../api/main/LoginController"
import { FeatureType } from "../../api/common/TutanotaConstants"
import { exportContacts } from "../../contacts/VCardExporter"
import { isNotNull, isSameTypeRef, lazyMemoized, NBSP, noOp, ofClass } from "@tutao/tutanota-utils"
import { theme } from "../../gui/theme"
import { BootIcons } from "../../gui/base/icons/BootIcons"
import { locator } from "../../api/main/MainLocator"
import { attachDropdown, DropdownButtonAttrs } from "../../gui/base/Dropdown.js"
import { moveMails } from "../../mail/view/MailGuiUtils"
import { exportMails } from "../../mail/export/Exporter"
import { IconButtonAttrs } from "../../gui/base/IconButton.js"
import { assertIsEntity2 } from "../../api/common/utils/EntityUtils.js"

assertMainOrNode()

export class MultiSearchViewer implements Component {
	view: Component["view"]
	private readonly searchListView: SearchListView
	private isMailList!: boolean
	private readonly mobileMailActionBarButtons: () => IconButtonAttrs[]
	private readonly mobileContactActionBarButtons: () => IconButtonAttrs[]

	constructor(searchListView: SearchListView) {
		this.searchListView = searchListView
		const contactActionBarButtons = this.createContactActionBarButtons(true)
		this.mobileMailActionBarButtons = () => this.createMailActionBarButtons(false)
		this.mobileContactActionBarButtons = lazyMemoized(() => this.createContactActionBarButtons(false))

		this.view = () => {
			if (this.searchListView._lastType) {
				if (this.searchListView._lastType === MailTypeRef) {
					this.isMailList = true
				} else {
					this.isMailList = false
				}
			} else {
				console.log("ERROR LIST TYPE NOT FOUND")
			}

			return [
				m(
					".fill-absolute.mt-xs.plr-l",
					this.searchListView.list && this.searchListView.list.getSelectedEntities().length > 0
						? this.viewingMails()
							? [
									// Add spacing so the buttons are where the mail view are
									m(
										".flex-space-between.button-min-height",
										m(".flex.flex-column-reverse", [
											m(".small.flex.text-break.selectable.badge-line-height.flex-wrap pt-s", NBSP),
											m("small.b.flex.pt", NBSP),
										]),
									),
									m(".flex-space-between.mr-negative-s", [
										m(".flex.items-center", this.getSearchSelectionMessage(this.searchListView)),
										m(ActionBar, {
											buttons: this.createMailActionBarButtons(true),
										}),
									]),
							  ]
							: [
									// Add spacing so buttons for contacts also align with the regular client view's buttons
									m(
										".header.pt-ml.flex-space-between",
										m(".left.flex-grow", [
											m(".contact-actions.flex-wrap.flex-grow-shrink", [
												m(".h2", NBSP),
												m(".flex-space-between", m(".flex-wrap.items-center", this.getSearchSelectionMessage(this.searchListView))),
											]),
										]),
										m(
											".action-bar.align-self-end",
											m(ActionBar, {
												buttons: contactActionBarButtons,
											}),
										),
									),
							  ]
						: m(ColumnEmptyMessageBox, {
								message: () => this.getSearchSelectionMessage(this.searchListView),
								color: theme.content_message_bg,
								icon: this.isMailList ? BootIcons.Mail : BootIcons.Contacts,
						  }),
				),
			]
		}
	}

	private getSearchSelectionMessage(searchListView: SearchListView): string {
		let nbrOfSelectedSearchEntities = searchListView.list ? searchListView.list.getSelectedEntities().length : 0

		if (this.isMailList) {
			if (nbrOfSelectedSearchEntities === 0) {
				return lang.get("noMail_msg")
			} else if (nbrOfSelectedSearchEntities === 1) {
				return lang.get("oneMailSelected_msg")
			} else {
				return lang.get("nbrOfMailsSelected_msg", {
					"{1}": nbrOfSelectedSearchEntities,
				})
			}
		} else {
			if (nbrOfSelectedSearchEntities === 0) {
				return lang.get("noContact_msg")
			} else if (nbrOfSelectedSearchEntities === 1) {
				return lang.get("oneContactSelected_msg")
			} else {
				return lang.get("nbrOfContactsSelected_msg", {
					"{1}": nbrOfSelectedSearchEntities,
				})
			}
		}
	}

	private createContactActionBarButtons(prependCancel: boolean = false): IconButtonAttrs[] {
		const buttons: (IconButtonAttrs | null)[] = [
			prependCancel
				? {
						title: "cancel_action",
						click: () => this.searchListView.list && this.searchListView.list.selectNone(),
						icon: Icons.Cancel,
				  }
				: null,
			{
				title: "delete_action",
				click: () => this.searchListView.deleteSelected(),
				icon: Icons.Trash,
			},
			this.searchListView.getSelectedEntities().length === 2
				? {
						title: "merge_action",
						click: () => this.mergeSelected(),
						icon: Icons.People,
				  }
				: null,
			{
				title: "exportSelectedAsVCard_action",
				click: () => {
					let selected = this.searchListView.getSelectedEntities()

					let selectedContacts = selected.map((e) => e.entry).filter(assertIsEntity2(ContactTypeRef))

					exportContacts(selectedContacts)
				},
				icon: Icons.Export,
			},
		]
		return buttons.filter(isNotNull)
	}

	private createMailActionBarButtons(prependCancel: boolean = false): IconButtonAttrs[] {
		const moveTargets = this.createMoveMailButtons()
		const move =
			moveTargets.length === 0
				? []
				: [
						attachDropdown({
							mainButtonAttrs: {
								title: "move_action",
								icon: Icons.Folder,
							},
							childAttrs: () => moveTargets,
						}),
				  ]

		const buttons: (IconButtonAttrs | null)[] = [
			prependCancel
				? {
						title: "cancel_action",
						click: () => this.searchListView.list && this.searchListView.list.selectNone(),
						icon: Icons.Cancel,
				  }
				: null,
			...move,
			{
				title: "delete_action",
				click: () => this.searchListView.deleteSelected(),
				icon: Icons.Trash,
			},
			attachDropdown({
				mainButtonAttrs: {
					title: "more_label",
					icon: Icons.More,
				},
				childAttrs: () => [
					{
						label: "markUnread_action",
						click: () => markMails(locator.entityClient, this.getSelectedMails(), true).then(() => this.searchListView.selectNone()),
						icon: Icons.NoEye,
					},
					{
						label: "markRead_action",
						click: () => markMails(locator.entityClient, this.getSelectedMails(), false).then(() => this.searchListView.selectNone()),
						icon: Icons.Eye,
					},
					!isApp() && !logins.isEnabled(FeatureType.DisableMailExport)
						? {
								label: "export_action",
								click: () =>
									showProgressDialog("pleaseWait_msg", exportMails(this.getSelectedMails(), locator.entityClient, locator.fileController)),
								icon: Icons.Export,
						  }
						: null,
				],
			}),
		]
		return buttons.filter(isNotNull)
	}

	private createMoveMailButtons(): DropdownButtonAttrs[] {
		let selected = this.searchListView.getSelectedEntities()

		let selectedMails = selected.map((e) => e.entry).filter(assertIsEntity2(MailTypeRef))

		return getMailMoveTargets(locator.mailModel, selectedMails).map((f) => ({
			label: () => getIndentedFolderNameForDropdown(f),
			click: () => {
				//is needed for correct selection behavior on mobile
				this.searchListView.selectNone()

				// move all groups one by one because the mail list cannot be modified in parallel
				return moveMails({ mailModel: locator.mailModel, mails: selectedMails, targetMailFolder: f.folder })
			},
			icon: getFolderIcon(f.folder),
		}))
	}

	private mergeSelected(): Promise<void> {
		if (this.searchListView.getSelectedEntities().length === 2) {
			if (isSameTypeRef(this.searchListView.getSelectedEntities()[0].entry._type, ContactTypeRef)) {
				let keptContact = this.searchListView.getSelectedEntities()[0].entry as any as Contact
				let goodbyeContact = this.searchListView.getSelectedEntities()[1].entry as any as Contact

				if (!keptContact.presharedPassword || !goodbyeContact.presharedPassword || keptContact.presharedPassword === goodbyeContact.presharedPassword) {
					return Dialog.confirm("mergeAllSelectedContacts_msg").then((confirmed) => {
						if (confirmed) {
							mergeContacts(keptContact, goodbyeContact)
							return showProgressDialog(
								"pleaseWait_msg",
								locator.entityClient.update(keptContact).then(() => {
									return locator.entityClient
										.erase(goodbyeContact)
										.catch(ofClass(NotFoundError, noOp))
										.then(() => {
											//is needed for correct selection behavior on mobile
											this.searchListView.selectNone()
										})
								}),
							)
						}
					})
				} else {
					return Dialog.message("presharedPasswordsUnequal_msg")
				}
			} else {
				return Promise.resolve()
			}
		} else {
			return Promise.resolve()
		}
	}

	private getSelectedMails(): Mail[] {
		let selected = this.searchListView.getSelectedEntities()
		return selected.map((e) => e.entry).filter(assertIsEntity2(MailTypeRef))
	}

	actionBarButtons(): IconButtonAttrs[] {
		return this.viewingMails() ? this.mobileMailActionBarButtons() : this.mobileContactActionBarButtons()
	}

	private viewingMails(): boolean {
		return this.searchListView._lastType.type === "Mail"
	}
}
